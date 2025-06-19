const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

const contractNames = ["ProyectoConstruccion", "CertificacionesObra", "LicitacionesPresupuestos"];
const frontendContractsDir = path.join(__dirname, '..', 'frontend', 'src', 'contracts');
const artifactsDir = path.join(__dirname, '..', 'artifacts', 'contracts');
const addressesSourcePath = path.join(__dirname, '..', 'contract-addresses.json');
const addressesDestPath = path.join(frontendContractsDir, 'addresses.json');

function ensureDirectoryExistence(filePath) {
  const dirname = path.dirname(filePath);
  if (fs.existsSync(dirname)) {
    return true;
  }
  ensureDirectoryExistence(dirname);
  fs.mkdirSync(dirname);
}

async function main() {
  console.log("Desplegando contratos en Hyperledger Besu (Método Manual)...");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Usando la cuenta:", deployer.address);

  const deployedContracts = {};

  for (const contractName of contractNames) {
    console.log(`\n--- Desplegando ${contractName} ---`);
    const ContractFactory = await hre.ethers.getContractFactory(contractName);
    
    // 1. Obtenemos los datos de la transacción de despliegue, sin enviarla todavía.
    const deployTx = await ContractFactory.getDeployTransaction();
    
    // 2. Añadimos manualmente nuestros overrides para forzar el precio de gas a cero.
    deployTx.gasPrice = 0;
    deployTx.type = 0; // Forzamos una transacción legacy.

    // 3. Firmamos y enviamos la transacción manualmente.
    console.log("Enviando transacción de despliegue...");
    const txResponse = await deployer.sendTransaction(deployTx);
    
    // 4. Esperamos a que la transacción sea minada y obtenemos el "recibo".
    console.log("Esperando confirmación de la transacción...");
    const receipt = await txResponse.wait();
    
    // 5. El recibo contiene la dirección del contrato desplegado.
    const address = receipt.contractAddress;
    
    console.log(`${contractName} desplegado en: ${address}`);
    deployedContracts[contractName] = address;
  }

  console.log("\nGuardando direcciones de contratos...");
  fs.writeFileSync(addressesSourcePath, JSON.stringify(deployedContracts, null, 2));
  console.log(`Direcciones guardadas en ${addressesSourcePath}`);

  console.log(`\nCopiando archivos a ${frontendContractsDir}...`);
  ensureDirectoryExistence(addressesDestPath);

  try {
    fs.copyFileSync(addressesSourcePath, addressesDestPath);
    console.log(`- ${path.basename(addressesSourcePath)} copiado y renombrado a ${path.basename(addressesDestPath)}`);
  } catch (err) {
    console.error(`Error copiando ${addressesSourcePath} a ${addressesDestPath}:`, err);
  }

  for (const contractName of contractNames) {
    const sourceArtifactPath = path.join(artifactsDir, `${contractName}.sol`, `${contractName}.json`);
    const destArtifactPath = path.join(frontendContractsDir, `${contractName}.json`);
    if (fs.existsSync(sourceArtifactPath)) {
      try {
        fs.copyFileSync(sourceArtifactPath, destArtifactPath);
        console.log(`- ${contractName}.json copiado correctamente.`);
      } catch (err) {
        console.error(`Error copiando ${contractName}.json:`, err);
      }
    } else {
      console.warn(`Advertencia: No se encontró el artifact en ${sourceArtifactPath}.`);
    }
  }

  console.log("\nCopia de archivos al frontend completada.");
  console.log("\nDespliegue y copia completados con éxito!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
