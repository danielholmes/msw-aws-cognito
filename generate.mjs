import { join as pathJoin } from "node:path";
import { readdir, readFile } from "node:fs/promises";
import { createSourceFile, ScriptTarget, SyntaxKind } from "typescript"

const typesDirpath = pathJoin(
    import.meta.dirname,
    "node_modules",
    "@aws-sdk",
    "client-cognito-identity-provider",
    "dist-types"
    // "models_0.d.ts"
);
const modelsDirpath = pathJoin(typesDirpath, "models");

async function getClientOperationNames() {
    const clientFilepath = pathJoin(typesDirpath, "CognitoIdentityProvider.d.ts");
    const file = createSourceFile(
        clientFilepath,
        await readFile(clientFilepath, "utf-8"),
        ScriptTarget.Latest
    );
    const children = file.getChildren()[0].getChildren();
    const client = children.find(
        c => c.kind === SyntaxKind.InterfaceDeclaration && c.name.escapedText === "CognitoIdentityProvider"
    );
    if (!client) {
        throw new Error("No client definition found");
    }
    
    return Array.from(
        new Set(
            client.members.map(m => m.name.escapedText)
        )
    );
}

const clientOperationNames = await getClientOperationNames();

const modelFilepaths = (await readdir(modelsDirpath))
    .filter(f => f.startsWith("models_"))
    .map(f => pathJoin(modelsDirpath, f));

const sourceFiles = await Promise.all(
    modelFilepaths.map(async (f) =>
        createSourceFile(
            f,
            await readFile(f, "utf-8"),
            ScriptTarget.Latest
        )
    )
);
const dtoSets = await Promise.all(
    sourceFiles.map(async (f) => {
        const rootItems = f.getChildren()[0].getChildren();
        return Object.fromEntries(
            rootItems.filter(
                i => i.kind === SyntaxKind.InterfaceDeclaration
            ).map(i => [
                i.name.escapedText,
                i
            ])
        );
        // console.log("dtos", Object.keys(dtos));
        // for (const operationName in operations) {
        //     const operation = operations[operationName];
        //     if (!operation.input || !operation.output) {
        //         throw new Error(`Mismatched command ${operationName}`);
        //     }
        // }
    })
);
const dtos = dtoSets.reduce((acc, set) => ({ ...acc, ...set }), {});
const clientOperations = clientOperationNames.reduce((acc, name) => {
    const upperName = name[0].toUpperCase() + name.slice(1);
    const requestDefinition = dtos[`${upperName}Request`];
    if (!requestDefinition) {
        throw new Error(`No request definition found for ${name}`);
    }
    const responseDefinition = dtos[`${upperName}Response`];
    // Some operations have no response
    // if (!responseDefinition) {
    //     throw new Error(`No response definition found for ${name}`);
    // }
    return [
        ...acc,
        {
            name,
            upperName,
            requestDefinition,
            responseDefinition
        }
    ];
}, []);
console.log("clientOperations", clientOperations.map(o => o.name));
// console.log("modelFilepaths", sourceFiles);