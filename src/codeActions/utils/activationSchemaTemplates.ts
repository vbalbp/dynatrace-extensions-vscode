export const humanReadableNames: Record<string, string> = {
  boolean: "Add boolean field",
  integer: "Add integer field",
  object: "Add object field",
  text: "Add text field",
  secret: "Add secret field",
  float: "Add float field",
  set: "Add set field",
  list: "Add list field",
  color: "Add color field",
  list_reference: "Add reference list field",
  select: "Add dropdown field",
  radio_button: "Add radio button field",
  hiVictor: "Get a picture of Victor",
  enums: "Add enumeration field",
  credentials: "Add credential vault integration",
  base_precondition: "Add precondition",
  not_precondition: "Add negative precondition",
  recursive_precondition: "Add recursive precondition",
  range: "Add range constraints",
  length: "Add length constraints",
  notBlank: "Add not blank constraints",
  trimmed: "Add trimmed constraints",
  noWhitespace: "Add no whitespace constraints",
};

export const componentTemplates: Record<string, string> = {
  enums: `"enums": {
  "enum_name": {
    "description": "",
    "documentation": "",
    "nullable": false,
    "type": "enum",
    "items": [
    {
        "displayName": "Option A",
        "description": "Description of option A",
        "value": "A",
        "icon": "apple"
    },
    {
        "displayName": "Option B",
        "description": "Description of option B",
        "value": "B",
        "icon": "windows"
    },
    {
        "displayName": "Option C",
        "description": "Description of option C",
        "value": "C",
        "icon": "linux"
    }
    ]
  }
}`,
};

export const propertyTemplates: Record<string, string> = {
  text: `"field_name": {
  "displayName": "Text Field",
  "description": "Description",
  "nullable": false,
  "type": "text",
  "default": ""
}`,
  secret: `"field_name": {
  "displayName": "Secret",
  "description": "Description",
  "nullable": false,
  "type": "secret",
  "default": ""
}`,
  boolean: `"field_name": {
  "displayName": "Boolean Field",
  "description": "Description",
  "nullable": false,
  "type": "boolean",
  "default": true
}`,
  integer: `"field_name": {
  "displayName": "Integer Field",
  "description": "Description",
  "nullable": false,
  "type": "integer",
  "default": 1
}`,
  float: `"field_name": {
  "displayName": "Float Field",
  "description": "Description",
  "nullable": false,
  "type": "float",
  "default": 1.00
}`,
  select: `"field_name": {
  "displayName": "Select",
  "description": "Description",
  "nullable": false,
  "type": {
    "$ref": "#/enums/enum_name"
  }
}`,
  radio_button: `"field_name": {
  "displayName": "Radio button",
  "description": "Description",
  "nullable": false,
  "type": {
    "$ref": "#/enums/enum_name"
  },
  "subType": "radio
}`,
  credentials: `"useCredentialVault": {
  "displayName": "Use credential vault",
  "type": "boolean",
  "nullable": false,
  "default": false,
  "maxObjects": 1
},
  "credentialVaultId": {
    "displayName": "Select vault credentials",
    "nullable": true,
    "type": "text",
    "subType": "credential",
    "referencedType": "USERNAME_PASSWORD",
    "maxObjects": 1,
    "precondition": {
      "type": "EQUALS",
      "property": "useCredentialVault",
      "expectedValue": true
    }
  },
  "username": {
    "displayName": "User name",
    "type": "text",
    "nullable": false,
    "default": "",
    "constraints": [
      {
        "type": "LENGTH",
        "minLength": 1,
        "maxLength": 500
      }
    ],
    "precondition": {
      "type": "NOT",
      "precondition": {
        "type": "EQUALS",
        "property": "useCredentialVault",
        "expectedValue": true
      }
    },
  "maxItems": 1
  },
  "password": {
    "displayName": "Password",
    "type": "secret",
    "nullable": false,
    "default": "",
    "constraints": [
      {
        "type": "LENGTH",
        "minLength": 1,
        "maxLength": 500
      }
    ],
    "precondition": {
      "type": "NOT",
      "precondition": {
        "type": "EQUALS",
        "property": "useCredentialVault",
        "expectedValue": true
      }
    },
  "maxItems": 1
}`,
  color: `"field_name": {
  "displayName": "Color",
  "description": "Description",
  "nullable": false,
  "default": "#FFEE7C",
  "type": "text",
  "subType": "color"
}`,
  set: `"field_name": {
  "displayName": "Set",
  "description": "Description",
  "nullable": false,
  "items": {
    "displayName": "Text Field",
    "description": "Description",
    "nullable": false,
    "type": "text",
    "default": ""
  },
  "type": "set"
}`,
  list: `"field_name": {
  "displayName": "List",
  "description": "Description",
  "nullable": false,
  "items": {
    "displayName": "Text Field",
    "description": "Description",
    "nullable": false,
    "type": "text",
    "default": ""
  },
  "type": "list"
}`,
  list_reference: `"field_name": {
  "displayName": "Object Reference",
  "description": "Description",
  "nullable": false,
  "type": "list",
  "items": {
    "type": {
      "$ref": "#/types/object_name"
    }
  }
}`,
  object: `"object_name": {
  "displayName": "",
  "description": "",
  "documentation": "",
  "version": "",
  "summaryPattern": "Summary: {textProp}",
  "type": "object",
  "properties": {
    "textProp": {
      "displayName": "Text Field",
      "description": "Description",
      "nullable": false,
      "type": "text",
      "default": "..."
    }
  }
}`,
  hiVictor: "😎",
};

export const numberConstraintTemplates: Record<string, string> = {
  range: `"constraints": [
    {
      "type": "RANGE",
      "minimum": 0,
      "maximum": 20,
      "customMessage": "My custom error message"
    }
  ]`,
};

export const stringConstraintTemplates: Record<string, string> = {
  length: `"constraints": [
  {
    "type": "LENGTH",
    "minLength": 1,
    "maxLength": 500,
    "customMessage": "My custom error message"
  }
]`,
  notBlank: `"constraints": [
  {
    "type": "NOT_BLANK",
    "customMessage": "My custom error message"
  }
]`,
  trimmed: `"constraints": [
  {
    "type": "TRIMMED",
    "customMessage": "My custom error message"
  }
]`,
  noWhitespace: `"constraints": [
  {
    "type": "NO_WHITESPACE",
    "customMessage": "My custom error message"
  }
]`,
};

export const preconditionTemplates: Record<string, string> = {
  base_precondition: `"precondition": {
  "type": "<EQUALS>/<IN>/<NULL>/<REGEX>",
  "property": "property name",
  "expectedValue": "value"
}`,
  not_precondition: `"precondition": {
  "type": "NOT",
  "precondition": {
    "type": "<EQUALS>/<IN>/<NULL>/<REGEX>",
    "property": "property name",
    "expectedValue": "value"
  }
}`,
  recursive_precondition: `"precondition": {
  "type": "<AND/OR>",
  "preconditions": [
    {
      "type": "<EQUALS>/<IN>/<NULL>/<REGEX>",
      "property": "property name",
      "expectedValue": "value"
    }
  ]
}`,
};
