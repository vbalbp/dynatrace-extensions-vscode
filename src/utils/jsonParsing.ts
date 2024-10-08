/**
  Copyright 2022 Dynatrace LLC

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

      https://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
 */

/********************************************************************************
 * UTILITIES FOR PARSING RAW YAML CONTENT
 ********************************************************************************/

import * as vscode from "vscode";
import * as logger from "../utils/logging";

interface CountMap {
  [key: string]: number[];
}

export function getPropertyValidLines(
  content: string,
): [number[], number[], number[], CountMap, number[]] {
  const validLines: number[] = [];
  const typeValidLines: number[] = [];
  const enumValidLines: number[] = [];
  const validLinesPerType: CountMap = {
    number: [],
    string: [],
  };
  const fileLines = content.split(/\r?\n/);
  let validPreconditionLines: number[] = [];
  let currentCount: number[] = [];
  let typesFound = false;
  let inProperties = false;
  let inSpecificProperty = false;
  let indentLevel = 0;
  let currentPropertyIndex = 0;
  let currentType = "";
  let i = 0;
  let openBrackets = 0;
  let closedBrackets = 0;
  let inString = false;

  fileLines.forEach(element => {
    if (typesFound) {
      if (inSpecificProperty) {
        currentCount.push(i);
        if (element.includes('"type": "text"') || element.includes('"type": "secret"')) {
          currentType = "string";
        }
        if (element.includes('"type": "integer"') || element.includes('"type": "float"')) {
          currentType = "number";
        }
      }
      if (openBrackets - closedBrackets == 1) {
        typesFound = false;
      } else {
        for (let j = 0; j < element.length; j++) {
          const char: string = element[j];
          if (char == '"' && !inString) {
            inString = true;
          }
          if (char == '"' && inString) {
            inString = false;
          }
          if (char == "{" && !inString) {
            openBrackets++;
          }
          if (char == "}" && !inString) {
            closedBrackets++;
          }
          if (
            char == "}" &&
            !inString &&
            inProperties &&
            openBrackets - closedBrackets == indentLevel
          ) {
            validLines.push(i);
          }
          if (inProperties && char == "{" && !inString) {
            inSpecificProperty = true;
            currentPropertyIndex = openBrackets - closedBrackets - 1;
          }
          if (
            inSpecificProperty &&
            char == "}" &&
            !inString &&
            openBrackets - closedBrackets == currentPropertyIndex
          ) {
            if (currentType !== "") {
              validLinesPerType[currentType] = validLinesPerType[currentType].concat(currentCount);
            }
            validPreconditionLines = validPreconditionLines.concat(currentCount);
            inSpecificProperty = false;
            currentPropertyIndex = 0;
            currentCount = [];
          }
          if (inProperties && !inString && openBrackets - closedBrackets == indentLevel - 1) {
            inProperties = false;
          }
          if (char == "}" && !inString && openBrackets - closedBrackets == 2 && !inProperties) {
            validLines.push(i);
          }
        }
        if (element.includes('"properties"')) {
          inProperties = true;
          indentLevel = openBrackets - closedBrackets;
          validLines.push(i);
        }
      }
    } else {
      for (let j = 0; j < element.length; j++) {
        const char: string = element[j];
        if (char == '"' && !inString) {
          inString = true;
        }
        if (char == '"' && inString) {
          inString = false;
        }
        if (char == "{" && !inString) {
          openBrackets++;
        }
        if (char == "}" && !inString) {
          closedBrackets++;
        }
        if (char == "}" && !inString && openBrackets - closedBrackets == 1) {
          enumValidLines.push(i);
        }
      }
    }
    if (element.includes('"types"')) {
      typesFound = true;
      typeValidLines.push(i);
    }
    i = i + 1;
  });

  return [validLines, typeValidLines, enumValidLines, validLinesPerType, validPreconditionLines];
}

/*
export function getComponentValidLines(content: string): number[] {
  const validLines: number[] = [];
  const fileLines = content.split(/\r?\n/);
  let inProperties = false;
  let i = 0;
  let openBrackets = 0;
  let closedBrackets = 0;
  let inString = false;

  fileLines.forEach(element => {
    if (inProperties) {
      for (let j = 0; j < element.length; j++) {
        const char: string = element[j];
        if (char == '"' && !inString) {
          inString = true;
        }
        if (char == '"' && inString) {
          inString = false;
        }
        if (char == "{" && !inString) {
          openBrackets++;
        }
        if (char == "}" && !inString) {
          closedBrackets++;
        }
        if (char == "}" && !inString && inProperties && openBrackets - closedBrackets == 2) {
          validLines.push(i);
        }
        if (inProperties && !inString && openBrackets - closedBrackets == 1) {
          inProperties = false;
        }
      }
    } else {
      for (let j = 0; j < element.length; j++) {
        const char: string = element[j];
        if (char == '"' && !inString) {
          inString = true;
        }
        if (char == '"' && inString) {
          inString = false;
        }
        if (char == "{" && !inString) {
          openBrackets++;
        }
        if (char == "}" && !inString) {
          closedBrackets++;
        }
      }
    }
    if (element.includes('"properties"') && openBrackets - closedBrackets == 2) {
      inProperties = true;
      validLines.push(i);
    }
    i = i + 1;
  });

  return validLines;
}
*/
