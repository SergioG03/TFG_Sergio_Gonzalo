# Plataforma Blockchain para el Sector de la Construcción

Este proyecto implementa una solución blockchain basada en Hyperledger Besu desplegada en Kubernetes (Minikube) para mejorar la gestión, transparencia y eficiencia en el sector de la construcción.

## Características Principales

- Red blockchain privada con Hyperledger Besu
- Smart contracts específicos para proyectos de construcción
- Gestión de certificaciones, licencias y permisos
- Sistema de licitaciones y presupuestos transparente
- Frontend para interactuar con los contratos

## Tecnologías Utilizadas

- Hyperledger Besu (blockchain privada compatible con Ethereum)
- Kubernetes & Minikube (orquestación de contenedores)
- Solidity (smart contracts)
- Hardhat (desarrollo y despliegue de contratos)
- HTML, CSS y JavaScript (frontend)
- ethers.js (interacción con blockchain)
- MetaMask (gestión de identidades)

## Requisitos

- Docker
- Minikube
- kubectl
- Node.js v16 (importante usar esta versión específica)
- Navegador con soporte para MetaMask

## Instalación y Configuración

### Preparación del Entorno

```bash
# Usar Node.js v16
nvm install 16
nvm use 16

### Compilar y Desplegar Contratos

```bash
# Instalar dependencias
npm install

# Compilar contratos
npx hardhat compile

# Desplegar contratos
npx hardhat run scripts/deploy.js --network besu
```

## Configuración de MetaMask

1. Instala la extensión MetaMask en tu navegador
2. Configura una nueva red:
   - Nombre: Besu Local
   - URL RPC: http://192.168.49.2:30545 (o la IP de Minikube)
   - ID de Cadena: 1337
   - Símbolo: ETH
3. Importa la cuenta de prueba con fondos:


## Posibles Problemas

- **Errores en Hardhat**: Asegúrate de usar Node.js v16 con `nvm use 16`
- **Error "Upfront cost exceeds account balance"**: La cuenta no tiene fondos suficientes
- **Problemas de conexión**: Verifica que Minikube está en ejecución

## Autor

Sergio Gonzalo - Universidad Camilo José Cela
