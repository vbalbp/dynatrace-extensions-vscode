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

/* eslint-disable @typescript-eslint/naming-convention */

import * as assert from "assert";
import * as mock from 'mock-fs';

import { sign } from "../../utils/cryptography";


const developerPem = `
-----BEGIN CERTIFICATE-----
MIIFejCCA2KgAwIBAgIUeWjuijtWhJFvrkTafpIAPLpJV5QwDQYJKoZIhvcNAQEL
BQAwTTEdMBsGA1UEAwwURGVmYXVsdCBFeHRlbnNpb24gQ0ExFTATBgNVBAoMDFNv
bWUgQ29tcGFueTEVMBMGA1UECwwMRXh0ZW5zaW9uIENBMB4XDTIyMDYxOTE5Mjgw
NloXDTI1MDYxOTE5MjgwNVowUDEXMBUGA1UEAwwOU29tZSBEZXZlbG9wZXIxFTAT
BgNVBAoMDFNvbWUgQ29tcGFueTEeMBwGA1UECwwVRXh0ZW5zaW9uIERldmVsb3Bt
ZW50MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEAybOlkrZTi8eIHfxw
VZpoF5jFY1EAeEiWaRFnYuq0kgeDjvM1h2o963k4hI71/bf+KxplI0sgw4O79FAU
3LSsI1aOz+R0lfJt/y07yyHQ/kN4g4JHC/RRDf6fH6DMt/VwAXMn3zQsFbyF3UyZ
flPkU07SohxVpuOzHnxqjujD1QakpNAr3buQd/7qmz82ABciVBbW+PjDjCCPm1X0
RP0Nb0pwbPZ10twf1q9Zfg4xk/k/yjyWqcE171Fr36x5oKyo+vhvILa6/C0CM0VS
q6DlhvlCwZZ6g5sJodfsrt0W6+yuuHxvwLY/Q+GThx4jHt93Mq8H99rhKyeN2LXo
j6kI0IeKgtPSgqyJ7te4d2EgfZ6FFxDbIisAciLs4VKHy2XDo/pkUbAVxntJYMoc
fd1szZG6UfT4UFIHGbUHHB0LnCltz6PUkcpVcSiu4+njCFSdhgKXpgyIr13lhDq0
tq6jigFPc5YLbAXic9DFKOWDYIwAFMiP7EIFAR1i1ATMYC0Mqny95XpcQUvk+34O
O9I/28aGhTsFrTwGuCTw0KDWSYMKR3Ek4cS7/S5QhGyYVGbN9IVGOeykskp0Cj5m
U1PhNE4y+R+OZ+ioarHejPW+V64gOpc0IivJO9mTnWYaWiFiOHM73QGNLFwKf/Lb
K2NWJqu4a5xD6Z3HavRLGxHTlZsCAwEAAaNPME0wHQYDVR0OBBYEFAfgluF1nRCY
mB5lMjOuFSA54ZIcMB8GA1UdIwQYMBaAFDMr4sWbgZAIA4oGlX6efh34SDj2MAsG
A1UdDwQEAwIHgDANBgkqhkiG9w0BAQsFAAOCAgEAAldQqiMz1Kt1r+nBCiI7+fTV
4TvItjRVDQU53TCuQ6Xe/wtvlVolT6UuSDjayCLNa18gAy/a56q5ds7xbJMoeQpW
klKEfKJhb1unrTvpriuu/ZtU5lL3MYFXKUJBvSDy86YHxklSesKTeuMc01PE439X
i/+p+MS3qEwhzgf5THnspM69MaWaBQK7PW5o84T2mwyTwuBcWnk/g/KoeIosZf2w
EKIygeL4AXHexlV0/cMza8muYofngZ44Rl/bkhD/cIWFQYbi5z7zv2U5xk+wr9au
PlnGGPY3O37VLDq6CpzKPdgauWm5o6md76c0gCTSjSjFkMWcyOrijoHqdiCj3PJW
gTFH++ACWMtfBm0ljXFloAJOOBSToMXwPLk+3FrqG2q81eSAYH1rDX8S1TPMi/m1
cdfmYLnmFp+63aMIT8fK1Qq9IWiX1M6SX5/gp2cTubvt6dtLVqwtt9gokNS6fCxN
MsNnt4y8nXCrlj/2w8CPDhByhmJKpNMNyZJUg3GKS8IXzwEekz/uKz3555xEAwme
quaF6wOV7Od9bzCoc7t1qM0O8fzssTGyHD5S/f1DLCA1XEr6zUo2rEJwuY6p8TTy
Ev9P3jYc76U1Z3O4V6h3bRrfF1Mx2BOgG/9/gam6C1yJS46M87yjeQIgJvjR5Dv3
Hr2J2TYrtM4W58cxaag=
-----END CERTIFICATE-----
`;

const developerKey = `
-----BEGIN RSA PRIVATE KEY-----
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
-----END RSA PRIVATE KEY-----
`;

const expectedCMS = `-----BEGIN CMS-----
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
yjCcpMEM1OlaIQD3lZg=
-----END CMS-----
`;

suite("Cryptography Test Suite", () => {


    /**
     * Tests the signing of a message
     */
    test("Test sign", () => {
        mock({
            "mock": {
                "extension.zip": "AAA",
                "developer.key": developerKey,
                "developer.pem": developerPem
            }
        });

        const cms = sign("mock/extension.zip", "mock/developer.key", "mock/developer.pem");

        // Needed because if the test runs on windows we get \r\n instead of \n
        const cmsNewLines = cms.replace(/\r?\n|\r/g, "\n");
        assert.strictEqual(cmsNewLines, expectedCMS);

    });

    suiteTeardown(() => {
        // Remove the fake file system
        mock.restore();
    });
});
