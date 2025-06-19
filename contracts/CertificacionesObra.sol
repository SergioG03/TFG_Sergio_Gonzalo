// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20; 

/**
 * @title CertificacionesObra
 * @dev Contrato para gestionar certificaciones y licencias de construcción 
 */
contract CertificacionesObra {
    // Estructura para representar una certificación o licencia
    struct Certificacion {
        uint256 id;
        string nombre;
        string descripcion;
        address emisor;
        address receptor;
        uint256 fechaEmision;
        uint256 fechaExpiracion;
        // bytes32 documentHash; 
        string documentCid;   
        TipoCertificacion tipo;
        bool revocada;
    }
    
    // Enumeración de tipos de certificaciones 
    enum TipoCertificacion { LicenciaObra, PermisoAmbiental, CertificadoSeguridad, InspeccionCalidad, FinObra, CertificadoEnergetico, Otro }
    
    // Evento emitido cuando se emite una nueva certificación
    // event CertificacionEmitida(uint256 id, string nombre, address emisor, address receptor); 
    event CertificacionEmitida(uint256 indexed id, address indexed emisor, address indexed receptor, string documentCid, TipoCertificacion tipo); 
    
    // Evento emitido cuando se revoca una certificación 
    event CertificacionRevocada(uint256 indexed id, address indexed revocadoPor, uint256 timestamp);
    
    // Evento emitido cuando se verifica una certificación 
    event CertificacionVerificada(uint256 indexed id, address indexed verificadoPor, uint256 timestamp);
    
    // Mapeo de certificaciones por ID
    mapping(uint256 => Certificacion) public certificaciones;
    
    // Mapeo de certificaciones por receptor
    mapping(address => uint256[]) public certificacionesPorReceptor;
    
    // Mapeo de certificaciones por emisor
    mapping(address => uint256[]) public certificacionesPorEmisor;
    
    // Contador para IDs de certificaciones
    uint256 private certificacionCounter;
    
    // Mapeo de emisores autorizados por tipo de certificación
    mapping(address => mapping(uint256 => bool)) public emisoresAutorizados;
    
    // Autoridad central que puede autorizar emisores
    address public autoridadCentral;
    
    /**
     * @dev Constructor que establece la autoridad central
     */
    constructor() {
        autoridadCentral = msg.sender;
    }
    
    // Modificador para asegurar que solo la autoridad central puede ejecutar ciertas funciones
    modifier soloAutoridadCentral() {
        require(msg.sender == autoridadCentral, "Solo la autoridad central puede realizar esta accion");
        _;
    }
    
    // Modificador para asegurar que el emisor está autorizado para el tipo de certificación
    modifier emisorAutorizado(uint256 _tipo) {
        require(emisoresAutorizados[msg.sender][_tipo] || msg.sender == autoridadCentral, 
                "No estas autorizado para emitir este tipo de certificacion");
        _;
    }
    
    /**
     * @dev Cambia la autoridad central
     * @param _nuevaAutoridad Dirección de la nueva autoridad central
     */
    function cambiarAutoridadCentral(address _nuevaAutoridad) 
        external 
        soloAutoridadCentral 
    {
        require(_nuevaAutoridad != address(0), "Direccion invalida");
        autoridadCentral = _nuevaAutoridad;
    }
    
    /**
     * @dev Autoriza a un emisor para un tipo específico de certificación
     * @param _emisor Dirección del emisor a autorizar
     * @param _tipo Tipo de certificación para el que se autoriza
     */
    function autorizarEmisor(address _emisor, uint256 _tipo) 
        external 
        soloAutoridadCentral 
    {
        require(_emisor != address(0), "Direccion invalida");
        require(_tipo <= uint256(TipoCertificacion.Otro), "Tipo de certificacion invalido");
        
        emisoresAutorizados[_emisor][_tipo] = true;
    }
    
    /**
     * @dev Revoca la autorización de un emisor para un tipo específico de certificación
     * @param _emisor Dirección del emisor a revocar
     * @param _tipo Tipo de certificación para el que se revoca la autorización
     */
    function revocarEmisor(address _emisor, uint256 _tipo) 
        external 
        soloAutoridadCentral 
    {
        require(_tipo <= uint256(TipoCertificacion.Otro), "Tipo de certificacion invalido");
        
        emisoresAutorizados[_emisor][_tipo] = false;
    }
    
    /**
     * @dev Emite una nueva certificación
     * @param _nombre Nombre de la certificación
     * @param _descripcion Descripción detallada
     * @param _receptor Dirección que recibe la certificación
     * @param _fechaExpiracion Timestamp de la fecha de expiración (0 para sin expiración)
     * @param _documentCid CID IPFS (como string) del documento de certificación
     * @param _tipo Tipo de certificación
     * @return id ID de la certificación emitida
     */
    function emitirCertificacion(
        string memory _nombre,
        string memory _descripcion,
        address _receptor,
        uint256 _fechaExpiracion,
        string memory _documentCid, 
        TipoCertificacion _tipo
    ) 
        external 
        emisorAutorizado(uint256(_tipo)) 
        returns (uint256) 
    {
        require(_receptor != address(0), "Receptor invalido");
        require(bytes(_documentCid).length > 0, "CID del documento es requerido"); 
        
        certificacionCounter++;
        
        Certificacion storage nuevaCertificacion = certificaciones[certificacionCounter];
        nuevaCertificacion.id = certificacionCounter;
        nuevaCertificacion.nombre = _nombre;
        nuevaCertificacion.descripcion = _descripcion;
        nuevaCertificacion.emisor = msg.sender;
        nuevaCertificacion.receptor = _receptor;
        nuevaCertificacion.fechaEmision = block.timestamp;
        nuevaCertificacion.fechaExpiracion = _fechaExpiracion;
        nuevaCertificacion.documentCid = _documentCid;   
        nuevaCertificacion.tipo = _tipo;
        nuevaCertificacion.revocada = false;
        
        // Registrar la certificación en los mapeos
        certificacionesPorReceptor[_receptor].push(certificacionCounter);
        certificacionesPorEmisor[msg.sender].push(certificacionCounter);
        
        // Emitir evento actualizado
        emit CertificacionEmitida(certificacionCounter, msg.sender, _receptor, _documentCid, _tipo);
        
        return certificacionCounter;
    }
    
    /**
     * @dev Revoca una certificación existente
     * @param _certificacionId ID de la certificación a revocar
     */
    function revocarCertificacion(uint256 _certificacionId) 
        external 
    {
        Certificacion storage certificacion = certificaciones[_certificacionId];
        
        require(certificacion.id != 0, "Certificacion no existe");
        require(!certificacion.revocada, "Certificacion ya revocada");
        require(
            msg.sender == certificacion.emisor || 
            msg.sender == autoridadCentral, 
            "Solo el emisor o la autoridad central pueden revocar la certificacion"
        );
        
        certificacion.revocada = true;
        
        emit CertificacionRevocada(_certificacionId, msg.sender, block.timestamp);
    }
    
    /**
     * @dev Verifica la validez de una certificación (función externa para emitir evento)
     * @param _certificacionId ID de la certificación a verificar
     * @return esValida Verdadero si la certificación es válida
     */
    function verificarCertificacion(uint256 _certificacionId) 
        external 
        returns (bool) 
    {
        bool esValida = esCertificacionValida(_certificacionId);
        emit CertificacionVerificada(_certificacionId, msg.sender, block.timestamp);
        return esValida;
    }

    /**
     * @dev Lógica interna para verificar la validez (puede ser usada por otras funciones)
     * @param _certificacionId ID de la certificación a verificar
     * @return Verdadero si la certificación es válida
     */
    function esCertificacionValida(uint256 _certificacionId) 
        public 
        view 
        returns (bool) 
    {
        Certificacion storage certificacion = certificaciones[_certificacionId];
        if (certificacion.id == 0) { return false; } // No existe
        
        return !certificacion.revocada && 
               (certificacion.fechaExpiracion == 0 || certificacion.fechaExpiracion > block.timestamp);
    }
    
    /**
     * @dev Obtiene todas las certificaciones de un receptor
     * @param _receptor Dirección del receptor
     */
    function obtenerCertificacionesDeReceptor(address _receptor) 
        external 
        view 
        returns (uint256[] memory) 
    {
        return certificacionesPorReceptor[_receptor];
    }
    
    /**
     * @dev Obtiene todas las certificaciones emitidas por un emisor
     * @param _emisor Dirección del emisor
     */
    function obtenerCertificacionesDeEmisor(address _emisor) 
        external 
        view 
        returns (uint256[] memory) 
    {
        return certificacionesPorEmisor[_emisor];
    }
    
    /**
     * @dev Obtiene la información completa de una certificación
     * @param _certificacionId ID de la certificación
     */
    function obtenerCertificacion(uint256 _certificacionId) 
        external 
        view 
        returns (
            uint256,        // id
            string memory,  // nombre
            string memory,  // descripcion
            address,        // emisor
            address,        // receptor
            uint256,        // fechaEmision
            uint256,        // fechaExpiracion
            string memory,  // documentCid (string)
            TipoCertificacion, // tipo
            bool            // revocada
        ) 
    {
        Certificacion storage certificacion = certificaciones[_certificacionId];
        require(certificacion.id != 0, "Certificacion no existe");
        
        return (
            certificacion.id,
            certificacion.nombre,
            certificacion.descripcion,
            certificacion.emisor,
            certificacion.receptor,
            certificacion.fechaEmision,
            certificacion.fechaExpiracion,
            certificacion.documentCid,   
            certificacion.tipo,
            certificacion.revocada
        );
    }
}
