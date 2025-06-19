import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { create } from 'ipfs-http-client';
import CertificacionesObraABI from '../contracts/CertificacionesObra.json';
import contractAddresses from '../contracts/addresses.json';

const ipfs = create({ url: '/ip4/127.0.0.1/tcp/5001' });
// ---------------------------------------------

const formatBigInt = (value) => (value !== undefined && value !== null ? value.toString() : 'N/A');
const formatDate = (timestampBigInt) => {
    if (!timestampBigInt || timestampBigInt === 0n) return 'N/A';
    try {
        const timestamp = Number(timestampBigInt);
        if (isNaN(timestamp)) return 'Invalid Date';
        return new Date(timestamp * 1000).toLocaleString();
    } catch (e) { return 'Invalid Date'; }
};
const getTipoCertificacionName = (tipoEnum) => {
    const tipoMap = ["LicenciaObra", "PermisoAmbiental", "CertificadoSeguridad", "InspeccionCalidad", "FinObra", "CertificadoEnergetico", "Otro"];
    try { return tipoMap[Number(tipoEnum)] || 'Desconocido'; } catch (e) { return 'ErrorTipo'; }
};

const mapCertData = (data) => ({
    id: data[0], nombre: data[1], descripcion: data[2], emisor: data[3], receptor: data[4],
    fechaEmision: data[5], fechaExpiracion: data[6], documentCid: data[7], 
    tipo: data[8], revocada: data[9]
});

const tipoCertificacionOptions = [
    { value: '0', label: 'Licencia de Obra' }, { value: '1', label: 'Permiso Ambiental' },
    { value: '2', label: 'Certificado de Seguridad' }, { value: '3', label: 'Inspección de Calidad' },
    { value: '4', label: 'Fin de Obra' }, { value: '5', label: 'Certificado Energético' },
    { value: '6', label: 'Otro' },
];


function Certificaciones({ signer, provider, account }) {
    const [contract, setContract] = useState(null);
    const [certificacionesRecibidas, setCertificacionesRecibidas] = useState([]);
    const [certificacionesEmitidas, setCertificacionesEmitidas] = useState([]);
    const [autoridadCentral, setAutoridadCentral] = useState('');
    const [loading, setLoading] = useState({ fetch: false, action: false, verify: {} });
    const [error, setError] = useState('');
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [newCertData, setNewCertData] = useState({ nombre: '', descripcion: '', receptor: '', fechaExpiracion: '', tipo: '0' });
    const [selectedFile, setSelectedFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    useEffect(() => {
        if (signer) {
            try {
                const contractInstance = new ethers.Contract(
                    contractAddresses.CertificacionesObra, CertificacionesObraABI.abi, signer
                );
                setContract(contractInstance);
            } catch (err) {
                setError("Error al inicializar el contrato de certificaciones."); setContract(null);
            }
        } else { setContract(null); }
    }, [signer]);

    const fetchCertificaciones = useCallback(async (currentContract, currentAccount) => {
        if (!currentContract || !currentAccount) return;
        setLoading(prev => ({ ...prev, fetch: true }));
        let accumulatedError = '';
        setCertificacionesRecibidas([]); setCertificacionesEmitidas([]);
        try {
            const reader = provider || currentContract.runner;
            const readerContract = currentContract.connect(reader);
            try { setAutoridadCentral(await readerContract.autoridadCentral()); } catch(authErr) { accumulatedError += `Error autoridad: ${authErr.message}. `; }
            try {
                const recibidasIds = await readerContract.obtenerCertificacionesDeReceptor(currentAccount);
                const recibidasProm = recibidasIds.map(id => readerContract.obtenerCertificacion(id).catch(err => null));
                setCertificacionesRecibidas((await Promise.all(recibidasProm)).filter(Boolean).map(mapCertData));
            } catch(recErr) { accumulatedError += `Error cert. recibidas: ${recErr.reason || recErr.message}. `; }
            try {
                const emitidasIds = await readerContract.obtenerCertificacionesDeEmisor(currentAccount);
                const emitidasProm = emitidasIds.map(id => readerContract.obtenerCertificacion(id).catch(err => null));
                setCertificacionesEmitidas((await Promise.all(emitidasProm)).filter(Boolean).map(mapCertData));
            } catch(emErr) { accumulatedError += `Error cert. emitidas: ${emErr.reason || emErr.message}. `; }
            setError(accumulatedError.trim() || '');
        } catch (err) { setError(`Error al cargar certificaciones: ${err.message}`); setCertificacionesRecibidas([]); setCertificacionesEmitidas([]); }
        finally { setLoading(prev => ({ ...prev, fetch: false })); }
    }, [provider]);

    useEffect(() => {
        if (contract && account) { fetchCertificaciones(contract, account); }
        else { setCertificacionesRecibidas([]); setCertificacionesEmitidas([]); setAutoridadCentral(''); }
    }, [contract, account, refreshTrigger, fetchCertificaciones]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setNewCertData(prev => ({ ...prev, [name]: value }));
    };
    const handleDateChange = (e) => {
        const { value } = e.target;
        setNewCertData(prev => ({ ...prev, fechaExpiracion: value }));
    };
    const handleFileChange = (e) => {
        if (e.target.files && e.target.files[0]) { setSelectedFile(e.target.files[0]); }
        else { setSelectedFile(null); }
    };

    const handleEmitirCertificacion = async (e) => {
         e.preventDefault();
         if (!contract) { setError("Contrato no cargado."); return; }
         if (!selectedFile) { setError("Debes seleccionar un archivo para la certificación."); alert("Error: Debes seleccionar un archivo."); return; }
         setLoading(prev => ({ ...prev, action: true })); setUploading(true); setError('');
         let documentCid = '';
         try {
             const result = await ipfs.add(selectedFile); documentCid = result.path; setUploading(false);
             const { nombre, descripcion, receptor, fechaExpiracion, tipo } = newCertData;
             if (!nombre || !descripcion || !receptor) throw new Error("Nombre, Descripción y Receptor son obligatorios.");
             if (!ethers.isAddress(receptor)) throw new Error("Dirección Receptor inválida.");
             // eslint-disable-next-line no-undef
             const timestampExpiracion = fechaExpiracion ? BigInt(Math.floor(new Date(fechaExpiracion).getTime() / 1000)) : 0n;
             const tx = await contract.emitirCertificacion( nombre, descripcion, receptor, timestampExpiracion, documentCid, parseInt(tipo) );
             await tx.wait();
             alert("¡Certificación emitida con éxito!"); setShowCreateForm(false);
             setNewCertData({ nombre: '', descripcion: '', receptor: '', fechaExpiracion: '', tipo: '0' }); setSelectedFile(null);
             if (document.getElementById('certFile')) document.getElementById('certFile').value = null;
             setRefreshTrigger(t => t + 1);
         } catch (err) {
             const errorReason = err.reason || err.data?.message || err.message;
             const displayError = `Error al emitir: ${errorReason || 'Error desconocido.'}`;
             setError(displayError + (err.code === 'CALL_EXCEPTION' ? ' Verifica datos/CID/permiso.' : ''));
             alert(displayError); setUploading(false);
         } finally { setLoading(prev => ({ ...prev, action: false })); }
    };

    const handleRevocarCertificacion = async (certId) => {
         if (!contract) { setError("Contrato no cargado."); return; }
         const certIdStr = formatBigInt(certId);
         if (!window.confirm(`¿Revocar certificación ID ${certIdStr}?`)) return;
         setLoading(prev => ({ ...prev, action: true, certId: certIdStr })); setError('');
         try { const tx = await contract.revocarCertificacion(certId); await tx.wait(); alert(`¡Certificación ID ${certIdStr} revocada!`); setRefreshTrigger(count => count + 1); }
         catch (err) { const msg = err.reason || err.data?.message || err.message || "Error."; setError(`Error al revocar ${certIdStr}: ${msg}`); alert(`Error: ${msg}`); }
         finally { setLoading(prev => ({ ...prev, action: false, certId: null })); }
     };
    const handleVerificarCertificacion = async (certId) => {
         const certIdStr = formatBigInt(certId); const reader = provider || contract?.runner;
         if (!contract || !reader) { setError("Wallet/Provider no disponible o contrato no cargado."); return; }
         setLoading(prev => ({ ...prev, verify: { ...prev.verify, [certIdStr]: true } })); setError('');
         try { const contractReader = contract.connect(reader); const esValida = await contractReader.verificarCertificacion.staticCall(certId); alert(`La certificación ID ${certIdStr} es: ${esValida ? 'VÁLIDA' : 'INVÁLIDA/EXPIRADA/REVOCADA'}`); }
         catch (err) { const msg = err.reason || err.data?.message || err.message || "Error."; setError(`Error al verificar ${certIdStr}: ${msg}`); alert(`Error al verificar ${certIdStr}: ${msg} (Puede ser inválida, expirada o revocada)`); }
         finally { setLoading(prev => ({ ...prev, verify: { ...prev.verify, [certIdStr]: false } })); }
     };
    const getCertStatus = (cert) => {
         if (cert.revocada) return { text: 'Revocada', className: 'cert-revocado' };
         const now = Math.floor(Date.now() / 1000); const expTimestamp = cert.fechaExpiracion;
         // eslint-disable-next-line no-undef
         if (expTimestamp !== 0n && Number(expTimestamp) < now) return { text: 'Expirada', className: 'cert-expirado' };
         return { text: 'Activa', className: 'cert-activo' };
     };

    const isAuthority = account && autoridadCentral && account.toLowerCase() === autoridadCentral.toLowerCase();
    if (!account) return <div className="connect-notice">Por favor, conecta tu wallet para gestionar certificaciones.</div>;
    if (loading.fetch && !contract) return <div className="loading-indicator">Inicializando y cargando datos...</div>;
    if (!contract && error.includes("inicializar")) return <div className="error-message">{error}</div>;

    return (
        <div className="page-container certificaciones-page">
             <div className="page-header">
                <h2>Gestión de Certificaciones</h2>
                 <button onClick={() => setShowCreateForm(!showCreateForm)} className="new-button" disabled={loading.action || uploading}>
                    {showCreateForm ? 'Ocultar Formulario' : 'Emitir Nueva Certificación'}
                 </button>
            </div>
            {error && !error.includes("inicializar") && <div className="error-message">{error}</div>}
            {showCreateForm && (
                <div className="form-container cert-form">
                    <h3>Emitir Nueva Certificación</h3>
                     <form onSubmit={handleEmitirCertificacion}>
                         <div className="form-group"> <label htmlFor="nombre">Nombre:</label> <input type="text" id="nombre" name="nombre" value={newCertData.nombre} onChange={handleInputChange} required disabled={uploading || loading.action} /> </div>
                         <div className="form-group"> <label htmlFor="descripcion">Descripción:</label> <textarea id="descripcion" name="descripcion" value={newCertData.descripcion} onChange={handleInputChange} required disabled={uploading || loading.action} /> </div>
                         <div className="form-group"> <label htmlFor="receptor">Receptor (Dirección Ethereum):</label> <input type="text" id="receptor" name="receptor" value={newCertData.receptor} onChange={handleInputChange} required placeholder="0x..." disabled={uploading || loading.action} /> </div>
                         <div className="form-group"> <label htmlFor="fechaExpiracionInput">Fecha Expiración (Opcional):</label> <input type="date" id="fechaExpiracionInput" name="fechaExpiracion" value={newCertData.fechaExpiracion} onChange={handleDateChange} disabled={uploading || loading.action} /> </div>
                         <div className="form-group"> <label htmlFor="certFile">Documento Adjunto:</label> <input type="file" id="certFile" name="certFile" onChange={handleFileChange} required disabled={uploading || loading.action} accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xml" /> {selectedFile && <small>Seleccionado: {selectedFile.name}</small>} </div>
                         <div className="form-group"> <label htmlFor="tipo">Tipo de Certificación:</label> <select id="tipo" name="tipo" value={newCertData.tipo} onChange={handleInputChange} required disabled={uploading || loading.action}> {tipoCertificacionOptions.map(opt => ( <option key={opt.value} value={opt.value}>{opt.label}</option> ))} </select> </div>
                         <div className="form-actions"> <button type="submit" disabled={loading.action || uploading || !selectedFile}> {uploading ? 'Subiendo Archivo...' : (loading.action ? 'Emitiendo Tx...' : 'Emitir Certificación')} </button> <button type="button" className="cancel-button" onClick={() => { setShowCreateForm(false); setSelectedFile(null); setNewCertData({ nombre: '', descripcion: '', receptor: '', fechaExpiracion: '', tipo: '0' }); }} disabled={loading.action || uploading}> Cancelar </button> </div>
                     </form>
                </div>
            )}
            <section className="list-section">
                <h3>Certificaciones Recibidas ({certificacionesRecibidas.length})</h3>
                {loading.fetch && <div className="loading-indicator">Cargando certificaciones recibidas...</div>}
                {!loading.fetch && certificacionesRecibidas.length === 0 && <div className="no-data">No has recibido ninguna certificación.</div>}
                <div className="item-list">
                    {certificacionesRecibidas.map(cert => {
                        const status = getCertStatus(cert); const certIdStr = formatBigInt(cert.id); const isLoadingVerify = loading.verify[certIdStr]; const ipfsGatewayUrl = cert.documentCid ? `https://ipfs.io/ipfs/${cert.documentCid}` : '#';
                        return (
                           <div key={certIdStr} className="item-card cert-card">
                                <div className="item-header"> <h4>{cert.nombre || 'Sin Nombre'}</h4> <span className={`status-badge ${status.className}`}>{status.text}</span> <span className="item-id">ID: {certIdStr}</span> </div>
                                <div className="item-details"> <p><strong>Tipo:</strong> {getTipoCertificacionName(cert.tipo)}</p> <p><strong>Descripción:</strong> {cert.descripcion || 'N/A'}</p> <p><strong>Emisor:</strong> <code className="address">{cert.emisor}</code></p> <p><strong>Emisión:</strong> {formatDate(cert.fechaEmision)}</p> <p><strong>Expiración:</strong> {formatDate(cert.fechaExpiracion)}</p> <p><strong>Doc. CID:</strong> {cert.documentCid ? ( <code className="hash" title={cert.documentCid}> <a href={ipfsGatewayUrl} target="_blank" rel="noopener noreferrer" title="Ver documento en IPFS"> {cert.documentCid.substring(0, 10)}...{cert.documentCid.substring(cert.documentCid.length - 4)} </a> </code> ) : 'N/A'} </p> </div>
                                <div className="item-actions"> <button onClick={() => handleVerificarCertificacion(cert.id)} disabled={loading.action || isLoadingVerify} className="action-button verify-button"> {isLoadingVerify ? 'Verificando...' : 'Verificar Validez'} </button> </div>
                            </div> );
                     })}
                </div>
            </section>
            <section className="list-section">
                <h3>Certificaciones Emitidas por Ti ({certificacionesEmitidas.length})</h3>
                {loading.fetch && <div className="loading-indicator">Cargando certificaciones emitidas...</div>}
                {!loading.fetch && certificacionesEmitidas.length === 0 && <div className="no-data">No has emitido ninguna certificación.</div>}
                 <div className="item-list">
                     {certificacionesEmitidas.map(cert => {
                          const status = getCertStatus(cert); const certIdStr = formatBigInt(cert.id); const isLoadingVerify = loading.verify[certIdStr]; const canRevoke = (account && cert.emisor && account.toLowerCase() === cert.emisor.toLowerCase()) || isAuthority; const isProcessingAction = loading.action; const ipfsGatewayUrl = cert.documentCid ? `https://ipfs.io/ipfs/${cert.documentCid}` : '#';
                         return (
                             <div key={certIdStr} className="item-card cert-card">
                                  <div className="item-header"> <h4>{cert.nombre || 'Sin Nombre'}</h4> <span className={`status-badge ${status.className}`}>{status.text}</span> <span className="item-id">ID: {certIdStr}</span> </div>
                                  <div className="item-details"> <p><strong>Tipo:</strong> {getTipoCertificacionName(cert.tipo)}</p> <p><strong>Receptor:</strong> <code className="address">{cert.receptor}</code></p> <p><strong>Descripción:</strong> {cert.descripcion || 'N/A'}</p> <p><strong>Emisión:</strong> {formatDate(cert.fechaEmision)}</p> <p><strong>Expiración:</strong> {formatDate(cert.fechaExpiracion)}</p> <p><strong>Doc. CID:</strong> {cert.documentCid ? ( <code className="hash" title={cert.documentCid}> <a href={ipfsGatewayUrl} target="_blank" rel="noopener noreferrer" title="Ver documento en IPFS"> {cert.documentCid.substring(0, 10)}...{cert.documentCid.substring(cert.documentCid.length - 4)} </a> </code> ) : 'N/A'} </p> </div>
                                  <div className="item-actions"> <button onClick={() => handleVerificarCertificacion(cert.id)} disabled={isProcessingAction || isLoadingVerify} className="action-button verify-button"> {isLoadingVerify ? 'Verificando...' : 'Verificar Validez'} </button> {canRevoke && !cert.revocada && ( <button onClick={() => handleRevocarCertificacion(cert.id)} className="action-button revoke-button" disabled={isProcessingAction || cert.revocada || (loading.action && loading.certId === certIdStr)}> {(loading.action && loading.certId === certIdStr) ? 'Revocando...' : 'Revocar'} </button> )} {cert.revocada && <span className="revoked-info">(Ya revocada)</span>} </div>
                             </div> );
                     })}
                 </div>
            </section>
        </div>
    );
}
export default Certificaciones;
