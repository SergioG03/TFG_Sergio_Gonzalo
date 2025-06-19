import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { create } from 'ipfs-http-client';
import LicitacionesPresupuestosABI from '../contracts/LicitacionesPresupuestos.json';
import contractAddresses from '../contracts/addresses.json';

const ipfs = create({ url: '/ip4/127.0.0.1/tcp/5001' });
// ---------------------------------------------

const formatBigInt = (value) => (value !== undefined && value !== null ? value.toString() : 'N/A');
const formatDate = (timestampBigInt) => {
    // eslint-disable-next-line no-undef
    if (!timestampBigInt || timestampBigInt === 0n) return 'N/A';
    try { const timestamp = Number(timestampBigInt); if (isNaN(timestamp)) return 'Invalid Date'; return new Date(timestamp * 1000).toLocaleString(); } catch (e) { return 'Invalid Date'; }
};
const formatEther = (weiValue) => {
    if (weiValue === undefined || weiValue === null) return 'N/A';
    try { return ethers.formatEther(weiValue) + ' ETH'; } catch (e) { return 'Invalid Value'; }
};

const mapLicitacionData = (data) => ({
    id: data[0], nombre: data[1], descripcion: data[2], creador: data[3], presupuestoMaximo: data[4], fechaCreacion: data[5], fechaLimite: data[6],
    documentacionCid: data[7], 
    abierta: data[8], adjudicada: data[9], contratista: data[10], ofertaGanadora: data[11]
});
const mapOfertaData = (data) => ({
    id: data[0], licitacionId: data[1], contratista: data[2], monto: data[3], tiempoEstimado: data[4],
    propuestaCid: data[5], 
    seleccionada: data[6]
});

function Licitaciones({ signer, provider, account }) {
    const [contract, setContract] = useState(null);
    const [loading, setLoading] = useState({ fetchGeneral: false, crearLic: false, presentarOferta: false, adjudicar: false, cerrar: false, fetchOfertasLic: {}, loadingLicId: null });
    const [uploading, setUploading] = useState({ licitacion: false, oferta: false });
    const [error, setError] = useState('');
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [newLicitacionData, setNewLicitacionData] = useState({ nombre: '', descripcion: '', presupuestoMaximo: '', fechaLimite: '' });
    const [selectedLicitacionFile, setSelectedLicitacionFile] = useState(null);
    const [showOfertaFormForLicId, setShowOfertaFormForLicId] = useState(null);
    const [newOfertaData, setNewOfertaData] = useState({ licitacionId: '', monto: '', tiempoEstimado: '' });
    const [selectedOfertaFile, setSelectedOfertaFile] = useState(null);
    const [licitacionesCreadas, setLicitacionesCreadas] = useState([]);
    const [ofertasPresentadas, setOfertasPresentadas] = useState([]);
    const [licitacionesAbiertas, setLicitacionesAbiertas] = useState([]);
    const [ofertasDeLicitacionVisible, setOfertasDeLicitacionVisible] = useState([]);
    const [licitacionIdOfertasVisibles, setLicitacionIdOfertasVisibles] = useState(null);

    useEffect(() => {
        if (signer) {
            try {
                const contractInstance = new ethers.Contract( contractAddresses.LicitacionesPresupuestos, LicitacionesPresupuestosABI.abi, signer );
                setContract(contractInstance);
            } catch (err) { setError("Error al inicializar el contrato de licitaciones."); setContract(null); }
        } else { setContract(null); }
    }, [signer]);

    const fetchLicitacionesData = useCallback(async (currentContract, currentAccount) => {
        if (!currentContract || !currentAccount) return;
        setLoading(prev => ({ ...prev, fetchGeneral: true })); setError(''); let accumulatedError = '';
        try {
            const reader = provider || currentContract.runner; const readerContract = currentContract.connect(reader);
            try { const creadasIds = await readerContract.obtenerLicitacionesDeCreador(currentAccount); const creadasProm = creadasIds.map(id => readerContract.obtenerLicitacion(id).catch(err => null)); setLicitacionesCreadas((await Promise.all(creadasProm)).filter(Boolean).map(mapLicitacionData)); } catch (err) { accumulatedError += `Error lic. creadas: ${err.reason || err.message}. `; }
            try { const ofertasIds = await readerContract.obtenerOfertasDeContratista(currentAccount); const ofertasProm = ofertasIds.map(id => readerContract.obtenerOferta(id).catch(err => null)); setOfertasPresentadas((await Promise.all(ofertasProm)).filter(Boolean).map(mapOfertaData)); } catch (err) { accumulatedError += `Error ofertas presentadas: ${err.reason || err.message}. `; }
            try {
                 const filtroEvento = readerContract.filters.LicitacionCreada(); let blockProvider = reader.provider || provider || signer?.provider; if (!blockProvider) throw new Error("Provider no disponible para eventos."); const currentBlock = await blockProvider.getBlockNumber(); const chunkSize = 2000; const startSearchBlock = 0; const allEvents = []; let chunkError = null;
                 for (let fromBlock = startSearchBlock; fromBlock <= currentBlock; fromBlock += chunkSize) { const toBlock = Math.min(fromBlock + chunkSize - 1, currentBlock); try { const chunkEvents = await readerContract.queryFilter(filtroEvento, ethers.toQuantity(fromBlock), ethers.toQuantity(toBlock)); allEvents.push(...chunkEvents); } catch (err) { if (err.code === -32005 || err.message?.includes("range exceeds maximum")) { chunkError = err; break; } else { chunkError = err; } } } if (chunkError) throw chunkError; const licitacionesAbiertasTemp = [];
                 if (allEvents.length > 0) { // eslint-disable-next-line no-undef
                    const allLicIds = [...new Set(allEvents.map(e => e.args.id))]; const licDetailsProm = allLicIds.map(id => readerContract.obtenerLicitacion(id).then(mapLicitacionData).catch(err => null)); const allLicDetails = (await Promise.all(licDetailsProm)).filter(Boolean); allLicDetails.forEach(licData => { if (licData.abierta && !licData.adjudicada && licData.creador.toLowerCase() !== currentAccount.toLowerCase()) licitacionesAbiertasTemp.push(licData); }); } setLicitacionesAbiertas(licitacionesAbiertasTemp);
            } catch (eventError) { accumulatedError += `Error eventos licitación: ${eventError.message || 'Error desconocido'}. `; setLicitacionesAbiertas([]); }
            if (accumulatedError) setError(accumulatedError.trim());
        } catch (err) { setError(`Error inesperado al cargar datos: ${err.message}`); }
        finally { setLoading(prev => ({ ...prev, fetchGeneral: false })); }
    }, [provider, signer]);

    useEffect(() => {
        if (contract && account) { fetchLicitacionesData(contract, account); }
        else { setLicitacionesCreadas([]); setOfertasPresentadas([]); setLicitacionesAbiertas([]); setOfertasDeLicitacionVisible([]); setLicitacionIdOfertasVisibles(null); }
    }, [contract, account, refreshTrigger, fetchLicitacionesData]);

    const handleVerOfertas = async (licitacionId) => {
        const licIdStr = formatBigInt(licitacionId); if (licitacionIdOfertasVisibles === licIdStr) { setLicitacionIdOfertasVisibles(null); setOfertasDeLicitacionVisible([]); return; } if (!contract) { setError("Contrato no cargado."); return; } setLoading(prev => ({ ...prev, fetchOfertasLic: { ...prev.fetchOfertasLic, [licIdStr]: true } })); setError(''); setOfertasDeLicitacionVisible([]);
        try { const reader = provider || contract.runner; const readerContract = contract.connect(reader); const ofertaIds = await readerContract.obtenerOfertasDeLicitacion(licitacionId); if (ofertaIds.length > 0) { const ofertasProm = ofertaIds.map(id => readerContract.obtenerOferta(id).catch(err => null)); const ofertasDetailsRaw = await Promise.all(ofertasProm); setOfertasDeLicitacionVisible(ofertasDetailsRaw.filter(Boolean).map(mapOfertaData)); } setLicitacionIdOfertasVisibles(licIdStr); }
        catch (err) { setError(`Error al cargar ofertas para Lic ${licIdStr}: ${err.reason || err.message}`); setLicitacionIdOfertasVisibles(null); setOfertasDeLicitacionVisible([]); }
        finally { setLoading(prev => ({ ...prev, fetchOfertasLic: { ...prev.fetchOfertasLic, [licIdStr]: false } })); }
    };

    const handleLicitacionInputChange = (e) => { const { name, value } = e.target; setNewLicitacionData(prev => ({ ...prev, [name]: value })); };
    const handleOfertaInputChange = (e) => { const { name, value } = e.target; setNewOfertaData(prev => ({ ...prev, [name]: value })); };
    const handleDateChange = (e) => { const { value } = e.target; setNewLicitacionData(prev => ({ ...prev, fechaLimite: value })); };
    const handleLicitacionFileChange = (e) => { if (e.target.files && e.target.files[0]) { setSelectedLicitacionFile(e.target.files[0]); } else { setSelectedLicitacionFile(null); } };
    const handleOfertaFileChange = (e) => { if (e.target.files && e.target.files[0]) { setSelectedOfertaFile(e.target.files[0]); } else { setSelectedOfertaFile(null); } };

    const handleCrearLicitacion = async (e) => {
        e.preventDefault(); if (!contract) { setError("Contrato no cargado"); return; } if (!selectedLicitacionFile) { setError("Debes seleccionar un archivo de documentación."); alert("Error: Debes seleccionar un archivo."); return; } setLoading(prev => ({ ...prev, crearLic: true })); setUploading(prev => ({ ...prev, licitacion: true })); setError(''); let documentacionCid = '';
        try {
            const result = await ipfs.add(selectedLicitacionFile); documentacionCid = result.path; setUploading(prev => ({ ...prev, licitacion: false }));
            const { nombre, descripcion, presupuestoMaximo, fechaLimite } = newLicitacionData; if (!nombre || !descripcion || !presupuestoMaximo || !fechaLimite) throw new Error("Nombre, Descripción, Presupuesto y Fecha Límite son obligatorios."); const presupuestoWei = ethers.parseEther(presupuestoMaximo); // eslint-disable-next-line no-undef
            const timestampLimite = fechaLimite ? BigInt(Math.floor(new Date(fechaLimite).getTime() / 1000)) : 0n; if (timestampLimite <= Math.floor(Date.now() / 1000)) throw new Error("La fecha límite debe ser futura.");
            const tx = await contract.crearLicitacion( nombre, descripcion, presupuestoWei, timestampLimite, documentacionCid ); await tx.wait();
            alert("¡Licitación creada!"); setShowCreateForm(false); setNewLicitacionData({ nombre: '', descripcion: '', presupuestoMaximo: '', fechaLimite: '' }); setSelectedLicitacionFile(null); if (document.getElementById('licDocFile')) document.getElementById('licDocFile').value = null; setRefreshTrigger(t => t + 1);
        } catch (err) { const msg = err.reason || err.data?.message || err.message || "Error."; setError(`Error: ${msg}`); alert(`Error: ${msg}`); setUploading(prev => ({ ...prev, licitacion: false })); }
        finally { setLoading(prev => ({ ...prev, crearLic: false })); }
    };

    const handlePresentarOferta = async (e) => {
        e.preventDefault(); if (!contract) { setError("Contrato no cargado"); return; } const licId = newOfertaData.licitacionId; if (!selectedOfertaFile) { setError("Debes seleccionar un archivo de propuesta técnica."); alert("Error: Debes seleccionar un archivo."); return; } setLoading(prev => ({ ...prev, presentarOferta: true })); setUploading(prev => ({ ...prev, oferta: true })); setError(''); let propuestaCid = '';
        try {
            const result = await ipfs.add(selectedOfertaFile); propuestaCid = result.path; setUploading(prev => ({ ...prev, oferta: false }));
            const { monto, tiempoEstimado } = newOfertaData; if (!licId || !monto || !tiempoEstimado) throw new Error("Licitación ID, Monto y Tiempo Estimado son obligatorios."); const montoWei = ethers.parseEther(monto); const tiempoEstNum = parseInt(tiempoEstimado); if (isNaN(tiempoEstNum) || tiempoEstNum <= 0) throw new Error("Tiempo estimado inválido.");
            const tx = await contract.presentarOferta( // eslint-disable-next-line no-undef
                BigInt(licId), montoWei, BigInt(tiempoEstNum), propuestaCid ); await tx.wait();
            alert("¡Oferta presentada!"); setShowOfertaFormForLicId(null); setNewOfertaData({ licitacionId: '', monto: '', tiempoEstimado: '' }); setSelectedOfertaFile(null); if (document.getElementById('ofertaPropFile')) document.getElementById('ofertaPropFile').value = null; setRefreshTrigger(t => t + 1);
        } catch (err) { const msg = err.reason || err.data?.message || err.message || "Error."; setError(`Error: ${msg}`); alert(`Error: ${msg}`); setUploading(prev => ({ ...prev, oferta: false })); }
        finally { setLoading(prev => ({ ...prev, presentarOferta: false })); }
    };

    const handleAdjudicar = async (licitacionId, ofertaId) => {
        if (!contract) { setError("Contrato no cargado"); return; } const licIdStr = formatBigInt(licitacionId); const ofertaIdStr = formatBigInt(ofertaId); if (!window.confirm(`¿Adjudicar oferta ID ${ofertaIdStr} para lic ID ${licIdStr}?`)) return; setLoading(prev => ({ ...prev, adjudicar: true, loadingLicId: licIdStr })); setError('');
        try { const tx = await contract.adjudicarLicitacion(licitacionId, ofertaId); await tx.wait(); alert("¡Licitación adjudicada!"); setLicitacionIdOfertasVisibles(null); setOfertasDeLicitacionVisible([]); setRefreshTrigger(t => t + 1); }
        catch (err) { const msg = err.reason || err.data?.message || err.message || "Error."; setError(`Error al adjudicar: ${msg}`); alert(`Error al adjudicar: ${msg}`); }
        finally { setLoading(prev => ({ ...prev, adjudicar: false, loadingLicId: null })); }
    };
    const handleCerrar = async (licitacionId) => {
         if (!contract) { setError("Contrato no cargado"); return; } const licIdStr = formatBigInt(licitacionId); if (!window.confirm(`¿Cerrar licitación ${licIdStr}?`)) return; setLoading(prev => ({ ...prev, cerrar: true, loadingLicId: licIdStr })); setError('');
         try { const tx = await contract.cerrarLicitacion(licitacionId); await tx.wait(); alert("¡Licitación cerrada!"); setRefreshTrigger(t => t + 1); }
         catch (err) { const msg = err.reason || err.data?.message || err.message || "Error."; setError(`Error al cerrar: ${msg}`); alert(`Error: ${msg}`); }
         finally { setLoading(prev => ({ ...prev, cerrar: false, loadingLicId: null })); }
    };

    if (!account) return <div className="connect-notice">Por favor, conecta tu wallet para gestionar licitaciones.</div>;
    if (loading.fetchGeneral && !contract) return <div className="loading-indicator">Inicializando y cargando datos...</div>;
    if (!contract && error.includes("inicializar")) return <div className="error-message">Error inicializando: {error}</div>;
    const isAnyActionLoading = loading.crearLic || loading.presentarOferta || loading.adjudicar || loading.cerrar || uploading.licitacion || uploading.oferta;

    return (
        <div className="page-container licitaciones-page">
            <div className="page-header"> <h2>Gestión de Licitaciones y Presupuestos</h2> <button onClick={() => setShowCreateForm(!showCreateForm)} className="new-button" disabled={isAnyActionLoading}> {showCreateForm ? 'Cancelar Creación' : 'Crear Nueva Licitación'} </button> </div>
            {error && <div className="error-message">{error}</div>}
            {showCreateForm && (
                 <div className="form-container lic-form">
                     <h3>Crear Nueva Licitación</h3>
                     <form onSubmit={handleCrearLicitacion}>
                          <div className="form-group"> <label htmlFor="lic_nombre">Nombre:</label> <input id="lic_nombre" type="text" name="nombre" value={newLicitacionData.nombre} onChange={handleLicitacionInputChange} required disabled={isAnyActionLoading} /> </div>
                          <div className="form-group"> <label htmlFor="lic_desc">Descripción:</label> <textarea id="lic_desc" name="descripcion" value={newLicitacionData.descripcion} onChange={handleLicitacionInputChange} required disabled={isAnyActionLoading} /> </div>
                          <div className="form-group"> <label htmlFor="lic_pres">Presupuesto Máximo (ETH):</label> <input id="lic_pres" type="number" step="any" name="presupuestoMaximo" value={newLicitacionData.presupuestoMaximo} onChange={handleLicitacionInputChange} required min="0" disabled={isAnyActionLoading} /> </div>
                          <div className="form-group"> <label htmlFor="lic_fecha">Fecha Límite Ofertas:</label> <input id="lic_fecha" type="date" name="fechaLimite" value={newLicitacionData.fechaLimite} onChange={handleDateChange} required disabled={isAnyActionLoading} /> </div>
                          <div className="form-group"> <label htmlFor="licDocFile">Documentación Adjunta:</label> <input type="file" id="licDocFile" name="licDocFile" onChange={handleLicitacionFileChange} required disabled={isAnyActionLoading} /> {selectedLicitacionFile && <small>Seleccionado: {selectedLicitacionFile.name}</small>} </div>
                          <div className="form-actions"> <button type="submit" disabled={isAnyActionLoading || !selectedLicitacionFile}> {uploading.licitacion ? 'Subiendo Archivo...' : (loading.crearLic ? 'Creando Tx...' : 'Crear Licitación')} </button> <button type="button" className="cancel-button" onClick={() => { setShowCreateForm(false); setSelectedLicitacionFile(null); setNewLicitacionData({ nombre: '', descripcion: '', presupuestoMaximo: '', fechaLimite: '' }); }} disabled={isAnyActionLoading}> Cancelar </button> </div>
                     </form>
                 </div>
            )}
            {showOfertaFormForLicId !== null && (
                 <div className="form-container oferta-form">
                     <h3>Presentar Oferta para Licitación ID: {showOfertaFormForLicId}</h3>
                     <form onSubmit={handlePresentarOferta}>
                          <input type="hidden" name="licitacionId" value={newOfertaData.licitacionId} />
                          <div className="form-group"> <label htmlFor="of_monto">Monto Ofertado (ETH):</label> <input id="of_monto" type="number" step="any" name="monto" value={newOfertaData.monto} onChange={handleOfertaInputChange} required min="0" disabled={isAnyActionLoading} /> </div>
                          <div className="form-group"> <label htmlFor="of_tiempo">Tiempo Estimado (días):</label> <input id="of_tiempo" type="number" name="tiempoEstimado" value={newOfertaData.tiempoEstimado} onChange={handleOfertaInputChange} required min="1" disabled={isAnyActionLoading}/> </div>
                          <div className="form-group"> <label htmlFor="ofertaPropFile">Propuesta Técnica Adjunta:</label> <input type="file" id="ofertaPropFile" name="ofertaPropFile" onChange={handleOfertaFileChange} required disabled={isAnyActionLoading} /> {selectedOfertaFile && <small>Seleccionado: {selectedOfertaFile.name}</small>} </div>
                          <div className="form-actions"> <button type="submit" disabled={isAnyActionLoading || !selectedOfertaFile}> {uploading.oferta ? 'Subiendo Archivo...' : (loading.presentarOferta ? 'Presentando Tx...' : 'Presentar Oferta')} </button> <button type="button" className="cancel-button" onClick={() => { setShowOfertaFormForLicId(null); setSelectedOfertaFile(null); setNewOfertaData({ licitacionId: '', monto: '', tiempoEstimado: '' }); }} disabled={isAnyActionLoading}> Cancelar </button> </div>
                     </form>
                 </div>
            )}
            <section className="list-section">
                 <h3>Licitaciones Abiertas (Otras) ({licitacionesAbiertas.length})</h3>
                 {loading.fetchGeneral && <div className="loading-indicator">Cargando...</div>}
                 {!loading.fetchGeneral && licitacionesAbiertas.length === 0 && <div className="no-data">No hay otras licitaciones abiertas disponibles.</div>}
                 <div className="item-list">
                     {licitacionesAbiertas.map(lic => {
                         const licIdStr = formatBigInt(lic.id); const canPresentOffer = !isAnyActionLoading && (showOfertaFormForLicId === null || showOfertaFormForLicId === licIdStr); const ipfsDocUrl = lic.documentacionCid ? `https://ipfs.io/ipfs/${lic.documentacionCid}` : '#';
                         return (
                             <div key={licIdStr} className="item-card lic-card lic-abierta">
                                <div className="item-header"> <h4>{lic.nombre}</h4> <span className="status-badge lic-abierta">Abierta</span> <span className="item-id">ID: {licIdStr}</span> </div>
                                <div className="item-details"> <p><strong>Desc:</strong> {lic.descripcion}</p> <p><strong>Presup. Max:</strong> {formatEther(lic.presupuestoMaximo)}</p> <p><strong>Límite Ofertas:</strong> {formatDate(lic.fechaLimite)}</p> <p><strong>Creador:</strong> <code className="address">{lic.creador}</code></p> <p><strong>Docs. CID:</strong> {lic.documentacionCid ? ( <code className="hash" title={lic.documentacionCid}> <a href={ipfsDocUrl} target="_blank" rel="noopener noreferrer" title="Ver documentación en IPFS"> {lic.documentacionCid.substring(0, 10)}...{lic.documentacionCid.substring(lic.documentacionCid.length - 4)} </a> </code> ) : 'N/A'} </p> </div>
                                <div className="item-actions"> <button onClick={() => { setNewOfertaData(prev => ({ ...prev, licitacionId: licIdStr })); setShowOfertaFormForLicId(licIdStr); setSelectedOfertaFile(null); }} disabled={!canPresentOffer} className="action-button"> {(showOfertaFormForLicId === licIdStr) ? 'Modificar/Ver Form. Oferta' : 'Presentar Oferta'} </button> </div>
                            </div> ); })}
                 </div>
             </section>
            <section className="list-section">
                <h3>Licitaciones Creadas por Ti ({licitacionesCreadas.length})</h3>
                 {loading.fetchGeneral && <div className="loading-indicator">Cargando...</div>}
                 {!loading.fetchGeneral && licitacionesCreadas.length === 0 && <div className="no-data">No has creado licitaciones.</div>}
                 <div className="item-list">
                    {licitacionesCreadas.map(lic => {
                        const statusClass = lic.adjudicada ? 'lic-adjudicada' : (lic.abierta ? 'lic-abierta' : 'lic-cerrada'); const statusText = lic.adjudicada ? 'Adjudicada' : (lic.abierta ? 'Abierta' : 'Cerrada'); const licIdStr = formatBigInt(lic.id); const isOfertasVisible = licitacionIdOfertasVisibles === licIdStr; const isLoadingOfertas = loading.fetchOfertasLic[licIdStr]; const isCurrentLicLoading = loading.loadingLicId === licIdStr && (loading.adjudicar || loading.cerrar); const canPerformAction = !isAnyActionLoading && !isLoadingOfertas && !isCurrentLicLoading; const ipfsDocUrl = lic.documentacionCid ? `https://ipfs.io/ipfs/${lic.documentacionCid}` : '#';
                        return (
                             <div key={licIdStr} className={`item-card lic-card ${statusClass}`}>
                                <div className="item-header"> <h4>{lic.nombre}</h4> <span className={`status-badge ${statusClass}`}>{statusText}</span> <span className="item-id">ID: {licIdStr}</span> </div>
                                <div className="item-details"> <p><strong>Desc:</strong> {lic.descripcion}</p> <p><strong>Presup. Max:</strong> {formatEther(lic.presupuestoMaximo)}</p> <p><strong>Límite Ofertas:</strong> {formatDate(lic.fechaLimite)}</p> <p><strong>Docs. CID:</strong> {lic.documentacionCid ? ( <code className="hash" title={lic.documentacionCid}> <a href={ipfsDocUrl} target="_blank" rel="noopener noreferrer" title="Ver documentación en IPFS"> {lic.documentacionCid.substring(0, 10)}...{lic.documentacionCid.substring(lic.documentacionCid.length - 4)} </a> </code> ) : 'N/A'} </p> {lic.adjudicada && ( <p><strong>Adjudicada a:</strong> <code className="address">{lic.contratista}</code> (Oferta ID: {formatBigInt(lic.ofertaGanadora)})</p> )} </div>
                                <div className="item-actions"> {lic.abierta && !lic.adjudicada && account && lic.creador && account.toLowerCase() === lic.creador.toLowerCase() && ( <> <button onClick={() => handleVerOfertas(lic.id)} disabled={!canPerformAction} className="action-button view-offers-button"> {isLoadingOfertas ? 'Cargando...' : (isOfertasVisible ? 'Ocultar Ofertas' : 'Ver Ofertas')} </button> <button onClick={() => handleCerrar(lic.id)} disabled={!canPerformAction} className="action-button revoke-button"> {(loading.cerrar && loading.loadingLicId === licIdStr) ? 'Cerrando...' : 'Cerrar sin Adjudicar'} </button> </> )} {!lic.abierta && !lic.adjudicada && <span className="status-text">Cerrada (sin adjudicar)</span>} </div>
                                {isOfertasVisible && (
                                     <div className="ofertas-list-container">
                                         <h4>Ofertas Recibidas ({ofertasDeLicitacionVisible.length})</h4>
                                         {isLoadingOfertas && <div className="loading-indicator small">Cargando ofertas...</div>}
                                         {!isLoadingOfertas && ofertasDeLicitacionVisible.length === 0 && <div className="no-data small">No hay ofertas para esta licitación.</div>}
                                         {!isLoadingOfertas && ofertasDeLicitacionVisible.length > 0 && (
                                             <ul className="nested-item-list">
                                                 {ofertasDeLicitacionVisible.map(oferta => {
                                                     const ofertaIdStr = formatBigInt(oferta.id); const canAdjudicateThis = canPerformAction && lic.abierta && !lic.adjudicada; const ipfsPropUrl = oferta.propuestaCid ? `https://ipfs.io/ipfs/${oferta.propuestaCid}` : '#';
                                                     return (
                                                         <li key={ofertaIdStr} className="nested-item-card oferta-card-nested">
                                                             <div className="nested-item-details"> <span><strong>ID Oferta:</strong> {ofertaIdStr}</span> <span><strong>Ofertante:</strong> <code className="address small">{oferta.contratista}</code></span> <span><strong>Monto:</strong> {formatEther(oferta.monto)}</span> <span><strong>Tiempo:</strong> {formatBigInt(oferta.tiempoEstimado)} días</span> <span><strong>Prop. CID:</strong> {oferta.propuestaCid ? ( <code className="hash small" title={oferta.propuestaCid}> <a href={ipfsPropUrl} target="_blank" rel="noopener noreferrer" title="Ver propuesta en IPFS"> {oferta.propuestaCid.substring(0, 8)}...{oferta.propuestaCid.substring(oferta.propuestaCid.length - 4)} </a> </code> ) : 'N/A'} </span> </div>
                                                             {account && lic.creador && account.toLowerCase() === lic.creador.toLowerCase() && ( <button onClick={() => handleAdjudicar(lic.id, oferta.id)} disabled={!canAdjudicateThis} className="action-button adjudicar-button" > {(loading.adjudicar && loading.loadingLicId === licIdStr) ? 'Adjudicando...' : 'Adjudicar Esta Oferta'} </button> )}
                                                         </li> ); })}
                                             </ul> )}
                                     </div> )}
                            </div> ); })}
                </div>
            </section>
            <section className="list-section">
                <h3>Ofertas Presentadas por Ti ({ofertasPresentadas.length})</h3>
                 {loading.fetchGeneral && <div className="loading-indicator">Cargando...</div>}
                 {!loading.fetchGeneral && ofertasPresentadas.length === 0 && <div className="no-data">No has presentado ofertas.</div>}
                 <div className="item-list">
                      {ofertasPresentadas.map(oferta => {
                          const ofertaIdStr = formatBigInt(oferta.id); const licIdStr = formatBigInt(oferta.licitacionId); const statusClass = oferta.seleccionada ? 'oferta-ganadora' : 'oferta-pendiente'; const statusText = oferta.seleccionada ? 'Seleccionada' : 'Pendiente'; const ipfsPropUrl = oferta.propuestaCid ? `https://ipfs.io/ipfs/${oferta.propuestaCid}` : '#';
                         return (
                             <div key={ofertaIdStr} className={`item-card oferta-card ${statusClass}`}>
                                <div className="item-header"> <h4>Oferta para Lic. ID: {licIdStr}</h4> <span className={`status-badge ${statusClass}`}>{statusText}</span> <span className="item-id">Oferta ID: {ofertaIdStr}</span> </div>
                                <div className="item-details"> <p><strong>Monto Ofertado:</strong> {formatEther(oferta.monto)}</p> <p><strong>Tiempo Estimado:</strong> {formatBigInt(oferta.tiempoEstimado)} días</p> <p><strong>Prop. CID:</strong> {oferta.propuestaCid ? ( <code className="hash" title={oferta.propuestaCid}> <a href={ipfsPropUrl} target="_blank" rel="noopener noreferrer" title="Ver propuesta en IPFS"> {oferta.propuestaCid.substring(0, 10)}...{oferta.propuestaCid.substring(oferta.propuestaCid.length - 4)} </a> </code> ) : 'N/A'} </p> </div>
                             </div> ); })}
                 </div>
            </section>
        </div>
    );
}
export default Licitaciones;
