import * as vscode from "vscode";
import * as path from "path";
import AdmZip = require("adm-zip");
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { getFusedCertKeyPath, sign } from "../utils/cryptography";
import { Dynatrace } from "../dynatrace-api/dynatrace";
import { DynatraceAPIError } from "../dynatrace-api/errors";
import { normalizeExtensionVersion, incrementExtensionVersion, getDatasourceName } from "../utils/extensionParsing";
import { FastModeStatus } from "../statusBar/fastMode";
import { exec, ExecOptions, ProcessEnvOptions } from "child_process";
import { getPythonPath } from "../utils/otherExtensions";
import { getExtensionFilePath, resolveRealPath } from "../utils/fileSystem";

type FastModeOptions = {
  status: FastModeStatus;
  document: vscode.TextDocument;
};

/**
 * Builds an Extension 2.0 and its artefacts into a .zip package ready to upload to Dynatrace.
 * The extension files must all be in an extension folder in the workspace, and developer
 * certificates must be available - either user's own or generated by this extension.
 * If successful, the command is linked to uploading the package to Dynatrace.
 * Note: Only custom extensions may be built/signed using this method.
 * @param context VSCode Extension Context
 * @param oc JSON OutputChannel where detailed errors can be logged
 * @param dt Dynatrace API Client if proper validation is to be done
 * @returns
 */
export async function buildExtension(
  context: vscode.ExtensionContext,
  oc: vscode.OutputChannel,
  dt?: Dynatrace,
  fastMode?: FastModeOptions
) {
  // Basic details we already know exist
  const workspaceStorage = context.storageUri!.fsPath;
  const workSpaceConfig = vscode.workspace.getConfiguration("dynatrace", null);
  const devKey = resolveRealPath(workSpaceConfig.get("developerKeyLocation") as string);
  const devCert = resolveRealPath(workSpaceConfig.get("developerCertificateLocation") as string);
  const workspaceRoot = vscode.workspace.workspaceFolders![0].uri.fsPath;
  const distDir = path.resolve(workspaceRoot, "dist");
  const extensionFile = fastMode ? fastMode.document.fileName : getExtensionFilePath(context)!;
  const extensionDir = path.resolve(extensionFile, "..");
  // Current name and version
  const extension = readFileSync(extensionFile).toString();
  const extensionName = /^name: "?([:a-zA-Z0-9.\-_]+)"?/gm.exec(extension)![1];
  const currentVersion = normalizeExtensionVersion(/^version: "?([0-9.]+)"?/gm.exec(extension)![1]);

  vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "Building extension",
    },
    async progress => {
      // Pre-build workflow
      let updatedVersion = "";
      progress.report({ message: "Checking prerequisites" });
      try {
        updatedVersion = fastMode
          ? await preBuildTasks(distDir, extensionFile, extension, extensionName, currentVersion, true, dt)
          : await preBuildTasks(distDir, extensionFile, extension, extensionName, currentVersion, false, dt);
      } catch (err: any) {
        vscode.window.showErrorMessage(`Error during pre-build phase: ${err.message}`);
        return;
      }

      // Package assembly workflow
      progress.report({ message: "Building extension package" });
      const zipFilename = `${extensionName.replace(":", "_")}-${updatedVersion}.zip`;
      try {
        if (/^python:$/gm.test(extension)) {
          const certKey = getFusedCertKeyPath(devKey, devCert, workspaceStorage);
          await assemblePython(workspaceStorage, path.resolve(extensionDir, ".."), certKey, oc);
        } else {
          assembleStandard(workspaceStorage, extensionDir, zipFilename, devKey, devCert);
        }
      } catch (err: any) {
        vscode.window.showErrorMessage(`Error during archiving & signing: ${err.message}`);
        return;
      }

      // Validation & upload workflow
      if (fastMode) {
        progress.report({ message: "Uploading & activating extension" });
        await uploadAndActivate(
          workspaceStorage,
          zipFilename,
          distDir,
          extensionName,
          updatedVersion,
          dt!,
          fastMode.status,
          oc
        );
      } else {
        progress.report({ message: "Validating extension" });
        const valid = await validateExtension(workspaceStorage, zipFilename, distDir, oc, dt);
        if (valid) {
          vscode.window
            .showInformationMessage(
              "Extension built successfully. Would you like to upload it to Dynatrace?",
              "Yes",
              "No"
            )
            .then(choice => {
              if (choice === "Yes") {
                vscode.commands.executeCommand("dt-ext-copilot.uploadExtension");
              }
            });
        }
      }
    }
  );
}

/**
 * Carries out general tasks that should be executed before the build workflow.
 * Ensures the dist folder exists and increments the extension version in case there might
 * be a conflict on the tenant (if dt is provided).
 * @param distDir path to the "dist" directory within the workspace
 * @param extensionFile path to the extension.yaml file
 * @param extensionContent contents of the extension.yaml file
 * @param extensionName the name of the extension
 * @param currentVersion the current version of the extension
 * @param forceIncrement whether to enforce the increment of currentVersion
 * @param dt optional Dynatrace API Client
 */
async function preBuildTasks(
  distDir: string,
  extensionFile: string,
  extensionContent: string,
  extensionName: string,
  currentVersion: string,
  forceIncrement: boolean = false,
  dt?: Dynatrace
): Promise<string> {
  // Create the dist folder if it doesn't exist
  if (!existsSync(distDir)) {
    mkdirSync(distDir);
  }

  const versionRegex = /^version: ("?[0-9.]+"?)/gm;
  const nextVersion = incrementExtensionVersion(currentVersion);

  if (forceIncrement) {
    // Always increment the version
    writeFileSync(extensionFile, extensionContent.replace(versionRegex, `version: ${nextVersion}`));
    vscode.window.showInformationMessage("Extension version automatically increased.");
    return nextVersion;
  } else if (dt) {
    // Increment the version if there is clash on the tenant
    const versions = await dt.extensionsV2
      .listVersions(extensionName)
      .then(ext => ext.map(e => e.version))
      .catch(() => [] as string[]);
    if (versions.includes(currentVersion)) {
      writeFileSync(extensionFile, extensionContent.replace(versionRegex, `version: ${nextVersion}`));
      vscode.window.showInformationMessage("Extension version automatically increased.");
      return nextVersion;
    }
  }
  return currentVersion;
}

/**
 * Carries out the archiving and signing parts of the extension build workflow.
 * The intermediary files (inner & outer .zips and signature) are created and stored
 * within the VS Code workspace storage folder to not crowd the user's workspace.
 * @param workspaceStorage path to the VS Code folder for this workspace's storage
 * @param extensionDir path to the "extension" folder within the workspace
 * @param zipFileName the name of the .zip file for this build
 * @param devKeyPath the path to the developer's private key
 * @param devCertPath the path to the developer's certificate
 */
function assembleStandard(
  workspaceStorage: string,
  extensionDir: string,
  zipFileName: string,
  devKeyPath: string,
  devCertPath: string
) {
  // Build the inner .zip archive
  const innerZip = new AdmZip();
  innerZip.addLocalFolder(extensionDir);
  const innerZipPath = path.resolve(workspaceStorage, "extension.zip");
  innerZip.writeZip(innerZipPath);
  console.log(`Built the inner archive: ${innerZipPath}`);

  // Sign the inner .zip archive and write the signature file
  const signature = sign(innerZipPath, devKeyPath, devCertPath);
  const sigatureFilePath = path.resolve(workspaceStorage, "extension.zip.sig");
  writeFileSync(sigatureFilePath, signature);
  console.log(`Wrote the signature file: ${sigatureFilePath}`);

  // Build the outer .zip that includes the inner .zip and the signature file
  const outerZip = new AdmZip();
  const outerZipPath = path.resolve(workspaceStorage, zipFileName);
  outerZip.addLocalFile(innerZipPath);
  outerZip.addLocalFile(sigatureFilePath);
  outerZip.writeZip(outerZipPath);
  console.log(`Wrote initial outer zip at: ${outerZipPath}`);
}

/**
 * Executes the given command in a child process and wraps the whole thing in a Promise.
 * This way the execution is async but other code can await it.
 * On success, returns the exit code (if any). Will throw any error with the message
 * part of the stderr (the rest is included via output channel)
 * @param command the command to execute
 * @param oc JSON output channel to communicate error details
 * @returns exit code or `null`
 */
function runCommand(command: string, oc: vscode.OutputChannel, envOptions?: ExecOptions): Promise<number | null> {
  let p = exec(command, envOptions);
  let [stdout, stderr] = ["", ""];
  return new Promise((resolve, reject) => {
    p.stdout?.on("data", data => (stdout += data.toString()));
    p.stderr?.on("data", data => (stderr += data.toString()));
    p.on("exit", code => {
      if (code !== 0) {
        let [shortMessage, details] = [stderr, [""]];
        if (stderr.includes("ERROR") && stderr.includes("+")) {
          [shortMessage, ...details] = stderr.substring(stderr.indexOf("ERROR") + 7).split("+");
        }
        oc.replace(
          JSON.stringify(
            { error: shortMessage.split("\r\n"), detailedOutput: `+${details.join("+")}`.split("\r\n") },
            null,
            2
          )
        );
        oc.show();
        reject(Error(shortMessage));
      }
      console.log(stdout);
      return resolve(code);
    });
  });
}

/**
 * Carries out the archiving and signing parts of the extension build workflow.
 * This function is meant for Python extesnions 2.0, therefore all the steps are carried
 * out through `dt-sdk` which must be available on the machine.
 * @param workspaceStorage path to the VS Code folder for this workspace's storage
 * @param extensionDir path to the root folder of the workspace
 * @param certKeyPath the path to the developer's fused private key & certificate
 * @param oc JSON output channel for communicating errors
 */
async function assemblePython(
  workspaceStorage: string,
  extensionDir: string,
  certKeyPath: string,
  oc: vscode.OutputChannel
) {
  let envOptions = {} as ExecOptions;
  const pythonPath = await getPythonPath();

  if (pythonPath !== "python") {
    envOptions = {
      env: {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        PATH: `${path.resolve(pythonPath, "..")}${path.delimiter}${process.env.PATH}`, // add the python bin directory to the PATH
        // eslint-disable-next-line @typescript-eslint/naming-convention
        VIRTUAL_ENV: path.resolve(pythonPath, "..", ".."), // virtual env is right above bin directory
      },
    };
  }

  // Check we can run dt-sdk
  await runCommand("dt-sdk --help", oc, envOptions); // this will throw if dt-sdk is not available

  // Build
  await runCommand(
    `dt-sdk build -k "${certKeyPath}" "${extensionDir}" -t "${workspaceStorage}" -e "${
      process.platform === "win32" ? "linux_x86_64" : "win_amd64"
    }"`,
    oc,
    envOptions
  );
}

/**
 * Validates a finalized extension archive against a Dynatrace tenant, if one is connected.
 * Returns true if either the extension passed validation or no API client is connected.
 * Upon success, the final extension archive is moved into the workspace's "dist" folder and
 * removed from the VSCode workspace storage folder (intermediary location).
 * @param workspaceStorage path to the VS Code folder for this workspace's storage
 * @param zipFileName the name of the .zip file for this build
 * @param distDir path to the "dist" folder within the workspace
 * @param oc JSON output channel for communicating errors
 * @param dt optional Dynatrace API Client (needed for real validation)
 * @returns validation status
 */
async function validateExtension(
  workspaceStorage: string,
  zipFileName: string,
  distDir: string,
  oc: vscode.OutputChannel,
  dt?: Dynatrace
) {
  var valid = true;
  const outerZipPath = path.resolve(workspaceStorage, zipFileName);
  const finalZipPath = path.resolve(distDir, zipFileName);
  if (dt) {
    await dt.extensionsV2.upload(readFileSync(outerZipPath), true).catch((err: DynatraceAPIError) => {
      vscode.window.showErrorMessage("Extension validation failed.");
      oc.replace(JSON.stringify(err.errorParams.data, null, 2));
      oc.show();
      valid = false;
    });
  }
  // Copy .zip archive into dist dir
  if (valid) {
    copyFileSync(outerZipPath, finalZipPath);
  }
  // Always remove from extension storage
  rmSync(outerZipPath);

  return valid;
}

/**
 * An all-in-one upload & activation flow designed to be used for fast mode builds.
 * If the extension limit has been reached on tenant, either the first or the last version is
 * removed automatically, the extension uploaded, and immediately activated.
 * This skips any prompts compared to regular flow and does not preform any validation.
 * @param workspaceStorage path to the VS Code folder for this workspace's storage
 * @param zipFileName the name of the .zip file for this build
 * @param distDir path to the "dist" folder within the workspace
 * @param extensionName name of the extension
 * @param extensionVersion version of the extension
 * @param dt Dynatrace API Client
 * @param status status bar to be updated with build status
 * @param oc JSON output channel for communicating errors
 */
async function uploadAndActivate(
  workspaceStorage: string,
  zipFileName: string,
  distDir: string,
  extensionName: string,
  extensionVersion: string,
  dt: Dynatrace,
  status: FastModeStatus,
  oc: vscode.OutputChannel
) {
  try {
    // Check upload possible
    var existingVersions = await dt.extensionsV2.listVersions(extensionName).catch(err => {
      return [];
    });
    if (existingVersions.length >= 10) {
      // Try delete oldest version
      await dt.extensionsV2.deleteVersion(extensionName, existingVersions[0].version).catch(async () => {
        // Try delete newest version
        await dt.extensionsV2.deleteVersion(extensionName, existingVersions[existingVersions.length - 1].version);
      });
    }

    const file = readFileSync(path.resolve(workspaceStorage, zipFileName));
    // Upload to Dynatrace
    do {
      var lastError;
      var uploadStatus: string = await dt.extensionsV2
        .upload(file)
        .then(() => "success")
        .catch((err: DynatraceAPIError) => {
          lastError = err;
          return err.errorParams.message;
        });
      // Previous version deletion may not be complete yet, loop until done.
      if (uploadStatus.startsWith("Extension versions quantity limit")) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } while (uploadStatus.startsWith("Extension versions quantity limit"));

    // Activate extension or throw error
    if (uploadStatus === "success") {
      dt.extensionsV2.putEnvironmentConfiguration(extensionName, extensionVersion);
    } else {
      throw lastError;
    }

    // Copy .zip archive into dist dir
    copyFileSync(path.resolve(workspaceStorage, zipFileName), path.resolve(distDir, zipFileName));
    status.updateStatusBar(true, extensionVersion, true);
    oc.clear();
  } catch (err: any) {
    // Mark the status bar as build failing
    status.updateStatusBar(true, extensionVersion, false);
    // Provide details in output channel
    oc.replace(
      JSON.stringify(
        {
          extension: extensionName,
          version: extensionVersion,
          errorDetails: err.errorParams,
        },
        null,
        2
      )
    );
    oc.show();
  } finally {
    rmSync(path.resolve(workspaceStorage, zipFileName));
  }
}
