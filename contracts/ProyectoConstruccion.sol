// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ProyectoConstruccion
 * @dev Contrato para gestionar proyectos de construcción
 */
contract ProyectoConstruccion {
    // Enumeración de fases del proyecto
    enum Fase {
        Planificacion,
        Diseno,
        Permisos,
        Construccion,
        Inspeccion,
        Finalizado
    }
    
    // Estructura para representar un proyecto de construcción
    struct Proyecto {
        uint256 id;
        string nombre;
        string ubicacion;
        uint256 presupuestoTotal;
        uint256 fondosDisponibles;
        uint256 fechaInicio;
        uint256 fechaFinPrevista;
        address propietario;
        bool activo;
        Fase faseActual;
    }
    
    // Estructura para representar un hito del proyecto
    struct Hito {
        uint256 id;
        uint256 proyectoId;
        string descripcion;
        uint256 presupuesto;
        uint256 fechaLimite;
        bool completado;
        address responsable;
    }
    
    // Contador para IDs de proyectos
    uint256 private proyectoCounter;
    
    // Contador para IDs de hitos
    uint256 private hitoCounter;
    
    // Mapeo de proyectos por ID
    mapping(uint256 => Proyecto) public proyectos;
    
    // Mapeo de hitos por ID
    mapping(uint256 => Hito) public hitos;
    
    // Mapeo de hitos por proyecto
    mapping(uint256 => uint256[]) public hitosDelProyecto;
    
    // Eventos
    event ProyectoCreado(uint256 id, string nombre, address propietario);
    event FaseActualizada(uint256 proyectoId, Fase fasePrevia, Fase faseNueva);
    event HitoCompletado(uint256 proyectoId, uint256 hitoId, address completadoPor);
    
    // Modificador para asegurar que solo el propietario del proyecto puede ejecutar ciertas funciones
    modifier soloPropietario(uint256 _proyectoId) {
        require(msg.sender == proyectos[_proyectoId].propietario, "Solo el propietario puede realizar esta accion");
        _;
    }
    
    // Modificador para asegurar que el proyecto está activo
    modifier proyectoActivo(uint256 _proyectoId) {
        require(proyectos[_proyectoId].activo, "El proyecto no esta activo");
        _;
    }
    
    /**
     * @dev Crea un nuevo proyecto de construcción
     * @param _nombre Nombre del proyecto
     * @param _ubicacion Ubicación física del proyecto
     * @param _presupuestoTotal Presupuesto total asignado al proyecto
     * @param _fechaInicio Timestamp de la fecha de inicio
     * @param _fechaFinPrevista Timestamp de la fecha de finalización prevista
     * @return id ID del proyecto creado
     */
    function crearProyecto(
        string memory _nombre,
        string memory _ubicacion,
        uint256 _presupuestoTotal,
        uint256 _fechaInicio,
        uint256 _fechaFinPrevista
    ) external returns (uint256) {
        proyectoCounter++;
        
        Proyecto storage nuevoProyecto = proyectos[proyectoCounter];
        nuevoProyecto.id = proyectoCounter;
        nuevoProyecto.nombre = _nombre;
        nuevoProyecto.ubicacion = _ubicacion;
        nuevoProyecto.presupuestoTotal = _presupuestoTotal;
        nuevoProyecto.fondosDisponibles = _presupuestoTotal;
        nuevoProyecto.fechaInicio = _fechaInicio;
        nuevoProyecto.fechaFinPrevista = _fechaFinPrevista;
        nuevoProyecto.propietario = msg.sender;
        nuevoProyecto.activo = true;
        nuevoProyecto.faseActual = Fase.Planificacion;
        
        emit ProyectoCreado(proyectoCounter, _nombre, msg.sender);
        
        return proyectoCounter;
    }
    
    /**
     * @dev Avanza a la siguiente fase del proyecto
     * @param _proyectoId ID del proyecto
     */
    function avanzarFase(uint256 _proyectoId) 
        external 
        soloPropietario(_proyectoId) 
        proyectoActivo(_proyectoId) 
    {
        Proyecto storage proyecto = proyectos[_proyectoId];
        Fase fasePrevia = proyecto.faseActual;
        
        if (proyecto.faseActual == Fase.Finalizado) {
            revert("El proyecto ya esta finalizado");
        }
        
        proyecto.faseActual = Fase(uint(proyecto.faseActual) + 1);
        
        emit FaseActualizada(_proyectoId, fasePrevia, proyecto.faseActual);
        
        if (proyecto.faseActual == Fase.Finalizado) {
            proyecto.activo = false;
        }
    }
    
    /**
     * @dev Añade un nuevo hito al proyecto
     * @param _proyectoId ID del proyecto
     * @param _descripcion Descripción del hito
     * @param _presupuesto Presupuesto asignado al hito
     * @param _fechaLimite Timestamp de la fecha límite para completar el hito
     * @param _responsable Dirección del responsable de completar el hito
     * @return id ID del hito creado
     */
    function anadirHito(
        uint256 _proyectoId,
        string memory _descripcion,
        uint256 _presupuesto,
        uint256 _fechaLimite,
        address _responsable
    ) 
        external 
        soloPropietario(_proyectoId) 
        proyectoActivo(_proyectoId) 
        returns (uint256) 
    {
        require(_presupuesto <= proyectos[_proyectoId].fondosDisponibles, "Presupuesto insuficiente");
        
        hitoCounter++;
        
        Hito storage nuevoHito = hitos[hitoCounter];
        nuevoHito.id = hitoCounter;
        nuevoHito.proyectoId = _proyectoId;
        nuevoHito.descripcion = _descripcion;
        nuevoHito.presupuesto = _presupuesto;
        nuevoHito.fechaLimite = _fechaLimite;
        nuevoHito.completado = false;
        nuevoHito.responsable = _responsable;
        
        // Reservar los fondos para este hito
        proyectos[_proyectoId].fondosDisponibles -= _presupuesto;
        
        // Añadir el hito a la lista de hitos del proyecto
        hitosDelProyecto[_proyectoId].push(hitoCounter);
        
        return hitoCounter;
    }
    
    /**
     * @dev Marca un hito como completado
     * @param _hitoId ID del hito
     */
    function completarHito(uint256 _hitoId) external {
        Hito storage hito = hitos[_hitoId];
        uint256 proyectoId = hito.proyectoId;
        
        require(proyectos[proyectoId].activo, "El proyecto no esta activo");
        require(!hito.completado, "El hito ya esta completado");
        require(msg.sender == hito.responsable, "Solo el responsable puede completar el hito");
        
        hito.completado = true;
        
        emit HitoCompletado(proyectoId, _hitoId, msg.sender);
    }
    
    /**
     * @dev Obtiene la información de un proyecto
     * @param _proyectoId ID del proyecto
     */
    function obtenerProyecto(uint256 _proyectoId) 
        external 
        view 
        returns (
            uint256,
            string memory,
            string memory,
            uint256,
            uint256,
            uint256,
            uint256,
            address,
            bool,
            Fase
        ) 
    {
        Proyecto storage proyecto = proyectos[_proyectoId];
        return (
            proyecto.id,
            proyecto.nombre,
            proyecto.ubicacion,
            proyecto.presupuestoTotal,
            proyecto.fondosDisponibles,
            proyecto.fechaInicio,
            proyecto.fechaFinPrevista,
            proyecto.propietario,
            proyecto.activo,
            proyecto.faseActual
        );
    }
    
    /**
     * @dev Obtiene la lista de hitos de un proyecto
     * @param _proyectoId ID del proyecto
     */
    function obtenerHitosDeProyecto(uint256 _proyectoId) 
        external 
        view 
        returns (uint256[] memory) 
    {
        return hitosDelProyecto[_proyectoId];
    }
    
    /**
     * @dev Calcula el progreso general del proyecto basado en hitos completados
     * @param _proyectoId ID del proyecto
     */
    function calcularProgresoProyecto(uint256 _proyectoId) 
        external 
        view 
        returns (uint256) 
    {
        uint256[] memory hitosProyecto = hitosDelProyecto[_proyectoId];
        
        if (hitosProyecto.length == 0) {
            return 0;
        }
        
        uint256 hitosCompletados = 0;
        
        for (uint256 i = 0; i < hitosProyecto.length; i++) {
            if (hitos[hitosProyecto[i]].completado) {
                hitosCompletados++;
            }
        }
        
        return (hitosCompletados * 100) / hitosProyecto.length;
    }
}
