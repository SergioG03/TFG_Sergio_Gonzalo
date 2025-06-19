// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20; 
/**
 * @title LicitacionesPresupuestos
 * @dev Contrato para gestionar licitaciones y presupuestos 
 */
contract LicitacionesPresupuestos {
    // Estructura para representar una licitación
    struct Licitacion {
        uint256 id;
        string nombre;
        string descripcion;
        address creador;
        uint256 presupuestoMaximo; 
        uint256 fechaCreacion;
        uint256 fechaLimite; 
        string documentacionCid;    
        bool abierta;
        bool adjudicada;
        address contratista; 
        uint256 ofertaGanadora; 
    }
    
    // Estructura para representar una oferta
    struct Oferta {
        uint256 id;
        uint256 licitacionId;
        address contratista; 
        uint256 monto; // en Wei
        uint256 tiempoEstimado;
        string propuestaCid;    
        bool seleccionada;
    }
    
    // Evento emitido cuando se crea una nueva licitación
    event LicitacionCreada(uint256 indexed id, address indexed creador, string documentacionCid, uint256 fechaLimite); 
    
    // Evento emitido cuando se presenta una nueva oferta
    event OfertaPresentada(uint256 indexed id, uint256 indexed licitacionId, address indexed contratista, string propuestaCid, uint256 monto); 
    
    // Evento emitido cuando se adjudica una licitación
    event LicitacionAdjudicada(uint256 indexed licitacionId, uint256 indexed ofertaId, address indexed contratista); 
    
    // Evento emitido cuando se cierra una licitación sin adjudicar (sin cambios)
    event LicitacionCerrada(uint256 indexed id, uint256 timestamp);
    
    // Mapeos (sin cambios)
    mapping(uint256 => Licitacion) public licitaciones;
    mapping(uint256 => Oferta) public ofertas;
    mapping(uint256 => uint256[]) public ofertasPorLicitacion;
    mapping(address => uint256[]) public licitacionesPorCreador;
    mapping(address => uint256[]) public ofertasPorContratista;
    
    // Contadores (sin cambios)
    uint256 private licitacionCounter;
    uint256 private ofertaCounter;
    
    // Modificadores (sin cambios)
    modifier soloCreadorLicitacion(uint256 _licitacionId) {
        require(msg.sender == licitaciones[_licitacionId].creador, "Solo el creador puede realizar esta accion");
        _;
    }
    modifier licitacionAbierta(uint256 _licitacionId) {
        require(licitaciones[_licitacionId].id != 0, "Licitacion no existe"); // Añadir chequeo existencia
        require(
            licitaciones[_licitacionId].abierta &&
            !licitaciones[_licitacionId].adjudicada &&
            block.timestamp <= licitaciones[_licitacionId].fechaLimite,
            "La licitacion no esta abierta para ofertas"
        );
        _;
    }
    
    /**
     * @dev Crea una nueva licitación
     * @param _nombre Nombre de la licitación
     * @param _descripcion Descripción detallada
     * @param _presupuestoMaximo Presupuesto máximo asignado (en Wei)
     * @param _fechaLimite Timestamp de la fecha límite para presentar ofertas
     * @param _documentacionCid CID IPFS (string) de la documentación completa
     * @return id ID de la licitación creada
     */
    function crearLicitacion(
        string memory _nombre,
        string memory _descripcion,
        uint256 _presupuestoMaximo, // Asumiendo Wei
        uint256 _fechaLimite,
        string memory _documentacionCid 
    ) 
        external 
        returns (uint256) 
    {
        require(_fechaLimite > block.timestamp, "La fecha limite debe ser en el futuro");
        require(bytes(_documentacionCid).length > 0, "CID documentacion es requerido");
        require(_presupuestoMaximo > 0, "Presupuesto debe ser mayor a 0");

        licitacionCounter++;
        
        Licitacion storage nuevaLicitacion = licitaciones[licitacionCounter];
        nuevaLicitacion.id = licitacionCounter;
        nuevaLicitacion.nombre = _nombre;
        nuevaLicitacion.descripcion = _descripcion;
        nuevaLicitacion.creador = msg.sender;
        nuevaLicitacion.presupuestoMaximo = _presupuestoMaximo;
        nuevaLicitacion.fechaCreacion = block.timestamp;
        nuevaLicitacion.fechaLimite = _fechaLimite;
        nuevaLicitacion.documentacionCid = _documentacionCid;   
        nuevaLicitacion.abierta = true;
        nuevaLicitacion.adjudicada = false;
        
        // Registrar la licitación en el mapeo de creador
        licitacionesPorCreador[msg.sender].push(licitacionCounter);
        
        // Emitir evento actualizado
        emit LicitacionCreada(licitacionCounter, msg.sender, _documentacionCid, _fechaLimite);
        
        return licitacionCounter;
    }
    
    /**
     * @dev Presenta una oferta para una licitación
     * @param _licitacionId ID de la licitación
     * @param _monto Monto de la oferta (en Wei)
     * @param _tiempoEstimado Tiempo estimado para completar el proyecto (en días u otra unidad)
     * @param _propuestaCid CID IPFS (string) de la propuesta detallada
     * @return id ID de la oferta creada
     */
    function presentarOferta(
        uint256 _licitacionId,
        uint256 _monto, // Asumiendo Wei
        uint256 _tiempoEstimado,
        string memory _propuestaCid 
    ) 
        external 
        licitacionAbierta(_licitacionId)
        returns (uint256) 
    {
        require(_monto > 0, "El monto debe ser mayor que cero");
        require(_monto <= licitaciones[_licitacionId].presupuestoMaximo, "La oferta excede el presupuesto maximo");
        require(_tiempoEstimado > 0, "El tiempo estimado debe ser mayor que cero");
        require(bytes(_propuestaCid).length > 0, "CID propuesta es requerido");
        
        ofertaCounter++;
        
        Oferta storage nuevaOferta = ofertas[ofertaCounter];
        nuevaOferta.id = ofertaCounter;
        nuevaOferta.licitacionId = _licitacionId;
        nuevaOferta.contratista = msg.sender;
        nuevaOferta.monto = _monto;
        nuevaOferta.tiempoEstimado = _tiempoEstimado;
        nuevaOferta.propuestaCid = _propuestaCid;  
        nuevaOferta.seleccionada = false;
        
        // Registrar la oferta en los mapeos
        ofertasPorLicitacion[_licitacionId].push(ofertaCounter);
        ofertasPorContratista[msg.sender].push(ofertaCounter);
        
        // Emitir evento actualizado
        emit OfertaPresentada(ofertaCounter, _licitacionId, msg.sender, _propuestaCid, _monto);
        
        return ofertaCounter;
    }
    
    /**
     * @dev Adjudica una licitación a una oferta
     * @param _licitacionId ID de la licitación
     * @param _ofertaId ID de la oferta ganadora
     */
    function adjudicarLicitacion(uint256 _licitacionId, uint256 _ofertaId) 
        external 
        soloCreadorLicitacion(_licitacionId)
    {
        Licitacion storage licitacion = licitaciones[_licitacionId];
        Oferta storage oferta = ofertas[_ofertaId];
        
        require(licitacion.abierta, "La licitacion no esta abierta"); // Implica que no está adjudicada
        require(!licitacion.adjudicada, "La licitacion ya ha sido adjudicada"); // Doble chequeo por si acaso
        require(oferta.licitacionId == _licitacionId, "La oferta no pertenece a esta licitacion");
        require(oferta.id != 0, "Oferta no existe"); // Chequeo de existencia de oferta

        licitacion.abierta = false;
        licitacion.adjudicada = true;
        licitacion.contratista = oferta.contratista;
        licitacion.ofertaGanadora = _ofertaId; 
        
        oferta.seleccionada = true;
        
        // Emitir evento actualizado
        emit LicitacionAdjudicada(_licitacionId, _ofertaId, oferta.contratista);
    }
    
    /**
     * @dev Cierra una licitación sin adjudicar
     * @param _licitacionId ID de la licitación
     */
    function cerrarLicitacion(uint256 _licitacionId) 
        external 
        soloCreadorLicitacion(_licitacionId)
    {
        Licitacion storage licitacion = licitaciones[_licitacionId];
        
        require(licitacion.id != 0, "Licitacion no existe"); // Chequeo existencia
        require(licitacion.abierta, "La licitacion no esta abierta");
        require(!licitacion.adjudicada, "La licitacion ya ha sido adjudicada");
        
        licitacion.abierta = false;
        
        emit LicitacionCerrada(_licitacionId, block.timestamp);
    }
    
    // --- Funciones de Consulta ---

    function obtenerOfertasDeLicitacion(uint256 _licitacionId) 
        external 
        view 
        returns (uint256[] memory) 
    {
        return ofertasPorLicitacion[_licitacionId];
    }
    
    function obtenerLicitacionesDeCreador(address _creador) 
        external 
        view 
        returns (uint256[] memory) 
    {
        return licitacionesPorCreador[_creador];
    }
    
    function obtenerOfertasDeContratista(address _contratista) 
        external 
        view 
        returns (uint256[] memory) 
    {
        return ofertasPorContratista[_contratista];
    }
    
    /**
     * @dev Obtiene la información completa de una licitación
     * @param _licitacionId ID de la licitación
     */
    function obtenerLicitacion(uint256 _licitacionId) 
        external 
        view 
        returns (
            uint256,        // id
            string memory,  // nombre
            string memory,  // descripcion
            address,        // creador
            uint256,        // presupuestoMaximo
            uint256,        // fechaCreacion
            uint256,        // fechaLimite
            string memory,  // documentacionCid (string)
            bool,           // abierta
            bool,           // adjudicada
            address,        // contratista
            uint256         // ofertaGanadora (ID)
        ) 
    {
        Licitacion storage licitacion = licitaciones[_licitacionId];
        require(licitacion.id != 0, "Licitacion no existe"); // Chequeo existencia
        
        return (
            licitacion.id,
            licitacion.nombre,
            licitacion.descripcion,
            licitacion.creador,
            licitacion.presupuestoMaximo,
            licitacion.fechaCreacion,
            licitacion.fechaLimite,
            licitacion.documentacionCid,   
            licitacion.abierta,
            licitacion.adjudicada,
            licitacion.contratista,
            licitacion.ofertaGanadora
        );
    }
    
    /**
     * @dev Obtiene la información completa de una oferta
     * @param _ofertaId ID de la oferta
     */
    function obtenerOferta(uint256 _ofertaId) 
        external 
        view 
        returns (
            uint256,        // id
            uint256,        // licitacionId
            address,        // contratista
            uint256,        // monto
            uint256,        // tiempoEstimado
            string memory,  // propuestaCid (string)
            bool            // seleccionada
        ) 
    {
        Oferta storage oferta = ofertas[_ofertaId];
        require(oferta.id != 0, "Oferta no existe"); // Chequeo existencia
        
        return (
            oferta.id,
            oferta.licitacionId,
            oferta.contratista,
            oferta.monto,
            oferta.tiempoEstimado,
            oferta.propuestaCid,    
            oferta.seleccionada
        );
    }
}
