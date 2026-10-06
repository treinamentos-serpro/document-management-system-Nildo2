import { useEffect, useState } from 'react';
import { Files, RefreshCw, UserRound } from 'lucide-react';
import UploadComponent from './components/UploadComponent.jsx';
import DocumentList from './components/DocumentList.jsx';
import { listDocuments } from './services/documentApi.js';
import './App.css';

export default function App() {
  const [userInput, setUserInput] = useState('');
  const [owner, setOwner] = useState('');
  const [result, setResult] = useState({ owner: '', documents: [] });
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const documents = result.owner === owner ? result.documents : [];

  useEffect(() => {
    if (!owner) return;
    const controller = new AbortController();
    setLoading(true);
    setError('');
    listDocuments(owner, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setResult({ owner, documents: data });
      })
      .catch((failure) => {
        if (!controller.signal.aborted) setError(failure.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [owner, revision]);

  function refreshDocuments() {
    setRevision((current) => current + 1);
  }

  function selectOwner(event) {
    event.preventDefault();
    const selectedOwner = userInput.trim();
    if (!selectedOwner || uploading) return;
    setOwner(selectedOwner);
    refreshDocuments();
  }

  return (
    <main className="workspace">
      <header className="workspace-header">
        <div className="brand"><Files size={30} strokeWidth={1.6} aria-hidden="true" /><div><h1>Document Management System</h1><p>Documentos</p></div></div>
        <span className="storage-label">Armazenamento local</span>
      </header>
      <section className="user-section" aria-labelledby="user-heading">
        <h2 id="user-heading"><UserRound size={18} aria-hidden="true" /> Usuário</h2>
        <form className="user-form" onSubmit={selectOwner}>
          <label htmlFor="user-id">Identificador</label>
          <input id="user-id" type="text" required value={userInput} disabled={uploading} onChange={(event) => setUserInput(event.target.value)} />
          <button className="secondary-button" type="submit" disabled={!userInput.trim() || uploading}>Selecionar</button>
        </form>
        {owner && <p className="current-user">Usuário atual: <strong>{owner}</strong></p>}
      </section>
      <UploadComponent key={owner} owner={owner} onUploaded={refreshDocuments} onPendingChange={setUploading} />
      <section className="documents-section" aria-labelledby="documents-heading" aria-busy={loading}>
        <div className="section-heading">
          <div className="list-title"><h2 id="documents-heading">Meus documentos</h2>{owner && !loading && !error && <span className="document-count">{documents.length}</span>}</div>
          <button className="icon-button" type="button" title="Atualizar lista" aria-label="Atualizar lista" disabled={!owner || loading} onClick={refreshDocuments}><RefreshCw size={18} aria-hidden="true" /></button>
        </div>
        <DocumentList documents={documents} owner={owner} loading={loading} error={error} />
      </section>
    </main>
  );
}
