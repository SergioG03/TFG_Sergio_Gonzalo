import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import ProyectoConstruccionABI from '../contracts/ProyectoConstruccion.json';
import contractAddresses from '../contracts/addresses.json';

const formatBigInt = (value) => (value !== undefined && value !== null ? value.toString() : 'N/A');

const formatDate = (timestampBigInt) => {
  if (!timestampBigInt || timestampBigInt === 0n) return 'N/A';
  try {
    const timestamp = Number(timestampBigInt);
    return new Date(timestamp * 1000).toLocaleString();
  } catch (e) {
    console.error("Error formatting date:", e);
    return 'Invalid Date';
  }
};

const getFaseName = (faseEnum) => {
  const faseMap = [
    "Planificacion", "Diseno", "Permisos",
    "Construccion", "Inspeccion", "Finalizado"
  ];
  return faseMap[Number(faseEnum)] || 'Desconocido';
};

function Proyectos({ signer, provider }) {
  const [contract, setContract] = useState(null);
  const [proyectos, setProyectos] = useState([]);
  const [proyectoCounter, setProyectoCounter] = useState(0); 
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);

  const [newProyectoData, setNewProyectoData] = useState({
    nombre: '',
    ubicacion: '',
    presupuestoTotal: '',
    fechaInicio: '',
    fechaFinPrevista: ''
  });

  useEffect(() => {
    if (signer) {
      const contractInstance = new ethers.Contract(
        contractAddresses.ProyectoConstruccion,
        ProyectoConstruccionABI.abi,
        signer
      );
      setContract(contractInstance);
      console.log("ProyectoConstruccion Contract instance created");
    } else {
      setContract(null);
    }
  }, [signer]);

  const fetchAllProyectos = useCallback(async () => {
      if (!contract) return;
      setLoading(true);
      setError('');
      try {
          const projectIdsToFetch = [1, 2, 3]; 
          const fetchedProyectos = [];

          for (const id of projectIdsToFetch) {
              try {
                   const projData = await contract.proyectos(id);
                   if (projData.id > 0) {
                       const details = await contract.obtenerProyecto(id);
                       fetchedProyectos.push({
                           id: details[0],
                           nombre: details[1],
                           ubicacion: details[2],
                           presupuestoTotal: details[3],
                           fondosDisponibles: details[4],
                           fechaInicio: details[5],
                           fechaFinPrevista: details[6],
                           propietario: details[7],
                           activo: details[8],
                           faseActual: details[9]
                       });
                   }
              } catch (fetchErr) {
                  console.warn(`Could not fetch project ID ${id}:`, fetchErr.message);
              }
          }

          setProyectos(fetchedProyectos);
      } catch (err) {
          console.error("Error fetching proyectos:", err);
          setError(`Error fetching proyectos: ${err.message}`);
          setProyectos([]); 
      } finally {
          setLoading(false);
      }
  }, [contract]);


  useEffect(() => {
    if (contract) {
      fetchAllProyectos();
    }
  }, [contract, fetchAllProyectos]);


  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewProyectoData(prev => ({ ...prev, [name]: value }));
  };

  const handleDateChange = (e, fieldName) => {
    const { value } = e.target;
    const timestamp = value ? Math.floor(new Date(value).getTime() / 1000) : '';
    setNewProyectoData(prev => ({ ...prev, [fieldName]: timestamp }));
  };

  const handleCrearProyecto = async (e) => {
    e.preventDefault();
    if (!contract || !signer) {
      setError("Wallet not connected or contract not loaded.");
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { nombre, ubicacion, presupuestoTotal, fechaInicio, fechaFinPrevista } = newProyectoData;
      if (!nombre || !ubicacion || !presupuestoTotal || !fechaInicio || !fechaFinPrevista) {
        throw new Error("Todos los campos son obligatorios.");
      }
      const presupuestoWei = BigInt(presupuestoTotal); 

      const tx = await contract.crearProyecto(
        nombre,
        ubicacion,
        presupuestoWei,
        BigInt(fechaInicio),
        BigInt(fechaFinPrevista)
      );
      console.log("Transaction sent:", tx.hash);
      await tx.wait();
      console.log("Transaction confirmed:", tx.hash);
      alert("Proyecto creado exitosamente!");
      setShowCreateForm(false);
      setNewProyectoData({ nombre: '', ubicacion: '', presupuestoTotal: '', fechaInicio: '', fechaFinPrevista: '' }); // Reset form
      fetchAllProyectos(); // Refresh list
    } catch (err) {
      console.error("Error creating proyecto:", err);
      setError(`Error al crear proyecto: ${err.data?.message || err.message}`);
      alert(`Error al crear proyecto: ${err.data?.message || err.message}`);
    } finally {
      setLoading(false);
    }
  };

   const handleAvanzarFase = async (proyectoId) => {
     if (!contract || !signer) return;
     setLoading(true); setError('');
     try {
       const tx = await contract.avanzarFase(proyectoId);
       await tx.wait();
       alert('Fase avanzada!');
       fetchAllProyectos();
     } catch (err) {
       console.error("Error avanzando fase:", err);
       setError(`Error al avanzar fase: ${err.data?.message || err.message}`);
       alert(`Error al avanzar fase: ${err.data?.message || err.message}`);
     } finally {
       setLoading(false);
     }
   };


  if (!signer) {
    return <div className="connect-notice">Por favor, conecta tu wallet para gestionar proyectos.</div>;
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h2>Gestión de Proyectos</h2>
        <button onClick={() => setShowCreateForm(!showCreateForm)} className="new-button">
          {showCreateForm ? 'Cancelar' : 'Nuevo Proyecto'}
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      {showCreateForm && (
        <div className="form-container">
          <h3>Crear Nuevo Proyecto</h3>
          <form onSubmit={handleCrearProyecto}>
            <div className="form-group">
              <label htmlFor="nombre">Nombre del Proyecto:</label>
              <input type="text" id="nombre" name="nombre" value={newProyectoData.nombre} onChange={handleInputChange} required />
            </div>
            <div className="form-group">
              <label htmlFor="ubicacion">Ubicación:</label>
              <input type="text" id="ubicacion" name="ubicacion" value={newProyectoData.ubicacion} onChange={handleInputChange} required />
            </div>
            <div className="form-group">
              <label htmlFor="presupuestoTotal">Presupuesto Total (en Wei):</label>
              <input type="number" id="presupuestoTotal" name="presupuestoTotal" value={newProyectoData.presupuestoTotal} onChange={handleInputChange} required min="0" />
            </div>
            <div className="form-group">
              <label htmlFor="fechaInicio">Fecha Inicio:</label>
              <input type="date" id="fechaInicio" name="fechaInicio" onChange={(e) => handleDateChange(e, 'fechaInicio')} required />
            </div>
            <div className="form-group">
              <label htmlFor="fechaFinPrevista">Fecha Fin Prevista:</label>
              <input type="date" id="fechaFinPrevista" name="fechaFinPrevista" onChange={(e) => handleDateChange(e, 'fechaFinPrevista')} required />
            </div>
            <div className="form-actions">
              <button type="submit" disabled={loading}>
                {loading ? 'Creando...' : 'Crear Proyecto'}
              </button>
            </div>
          </form>
        </div>
      )}

      <h3>Lista de Proyectos</h3>
      {loading && <div className="loading">Cargando proyectos...</div>}
      {!loading && proyectos.length === 0 && <div className="no-data">No se encontraron proyectos o necesita implementar la lógica para listarlos.</div>}

      <div className="item-list proyectos-list">
        {proyectos.map((proyecto) => (
          <div key={formatBigInt(proyecto.id)} className="item-card proyecto-card">
            <div className="item-header">
              <h4>{proyecto.nombre}</h4>
               <span className={`badge fase-${Number(proyecto.faseActual)}`}>
                 {getFaseName(proyecto.faseActual)}
               </span>
               <span className="item-id">ID: {formatBigInt(proyecto.id)}</span>
            </div>
            <div className="proyecto-details">
              <p><strong>Ubicación:</strong> {proyecto.ubicacion}</p>
              <p><strong>Propietario:</strong> {proyecto.propietario}</p>
              <p><strong>Presupuesto:</strong> {formatBigInt(proyecto.presupuestoTotal)} Wei</p>
              <p><strong>Fondos Disp.:</strong> {formatBigInt(proyecto.fondosDisponibles)} Wei</p>
              <p><strong>Inicio:</strong> {formatDate(proyecto.fechaInicio)}</p>
              <p><strong>Fin Previsto:</strong> {formatDate(proyecto.fechaFinPrevista)}</p>
              <p><strong>Activo:</strong> {proyecto.activo ? 'Sí' : 'No'}</p>
            </div>
            <div className="proyecto-actions">
               {proyecto.activo && Number(proyecto.faseActual) < 5 && ( // Show only if active and not finalized
                 <button onClick={() => handleAvanzarFase(proyecto.id)} disabled={loading}>
                   {loading ? '...' : 'Avanzar Fase'}
                 </button>
               )}
              {}
              {}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Proyectos;
