import * as vscode from "vscode";
import * as path from "path";
import AdmZip = require("adm-zip");
import * as yaml from "yaml";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "fs";
import { sign } from "../utils/cryptography";


var crypto = require('crypto');
/**
 * THIS FUNCTIONALITY IS WORK IN PROGRESS. IT MAY OR MAY NOT WORK.
 * @param context
 * @returns
 */
export async function buildExtension(context: vscode.ExtensionContext) {
  var extensionFile = await vscode.workspace.findFiles("**/extension.yaml");

  if (vscode.workspace.workspaceFolders) {
    // Create the dist folder if it doesn't exist
    var rootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
    var distDir = vscode.Uri.file(path.resolve(path.join(rootPath, "dist")));
    if (!vscode.workspace.getWorkspaceFolder(distDir)) {
      vscode.workspace.fs.createDirectory(distDir);
    }
    var extensionDir = path.dirname(extensionFile[0].fsPath);
    var devKeyPath;
    var devCertPath;

    // WORKAROUND UNTIL DIY SNIPPET IS FIXED
    if (
      existsSync(path.join(context.storageUri!.fsPath, "certificates", "dev.key")) &&
      existsSync(path.join(context.storageUri!.fsPath, "certificates", "dev.pem"))
    ) {
      devKeyPath = path.join(context.storageUri!.fsPath, "certificates", "dev.key");
      devCertPath = path.join(context.storageUri!.fsPath, "certificates", "dev.pem");
    } else {
      devKeyPath = path.resolve(
        vscode.workspace
          .getConfiguration()
          .get("dynatrace.certificate.location.developerKey") as string
      );
      devCertPath = path.resolve(
        vscode.workspace
          .getConfiguration()
          .get("dynatrace.certificate.location.developerCertificate") as string
      );
    }

    // Extension meta
    const extension = yaml.parse(readFileSync(extensionFile[0].fsPath).toString());

    // Build the inner .zip archive
    const innerZip = new AdmZip();
    innerZip.addLocalFolder(extensionDir);
    const innerZipPath = path.join(context.storageUri!.fsPath, "extension.zip");
    innerZip.writeZip(innerZipPath);
    console.log(`Built the inner archive: ${innerZipPath}`);

    // Sign the inner .zip archive and write the signature file
    const signature = sign(innerZipPath, distDir.fsPath, devKeyPath, devCertPath);
    const sigatureFilePath = path.join(context.storageUri!.fsPath, "extension.zip.sig");
    writeFileSync(sigatureFilePath, signature);
    console.log(`Wrote the signature file: ${sigatureFilePath}`);

    // Build the outer .zip that includes the inner .zip and the signature file
    var outerZip = new AdmZip();
    const outerZipPath = path.join(distDir.fsPath, `${extension.name.replace(":", "_")}-${extension.version}.zip`)
    outerZip.addLocalFile(innerZipPath);
    outerZip.addLocalFile(sigatureFilePath);
    outerZip.writeZip(outerZipPath);
    console.log(`Wrote the outer zip: ${outerZipPath}`);

    vscode.window.showInformationMessage("Extension built successfully to the dist folder.");
  }
}


