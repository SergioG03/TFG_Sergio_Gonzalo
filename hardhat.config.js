require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const privateKey = process.env.PRIVATE_KEY;
if (!privateKey) {
  console.error("Por favor, define la variable de entorno PRIVATE_KEY en tu archivo .env");
  process.exit(1);
}

module.exports = {
  solidity: "0.8.24",
  paths: {
    artifacts: './frontend/src/artifacts',
  },
  networks: {
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337
    },
    besu: {
      url: "http://127.0.0.1:8545",
      chainId: 1337,
      accounts: [privateKey]
    }
  }
};
