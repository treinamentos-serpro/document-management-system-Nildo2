import { useState } from 'react';
import { LoaderCircle, Upload } from 'lucide-react';
import { uploadDocument } from '../services/documentApi.js';

export default function UploadComponent({ owner, onUploaded, onPendingChange }) {
  const [file, setFile] = useState(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    if (!file || !owner || pending) return;
    const form = event.currentTarget;
    setError('');
    setSuccess('');
    if (file.size === 0) {
      setError('Selecione um arquivo não vazio.');
      return;
    }
    setPending(true);
    onPendingChange(true);
    try {
      await uploadDocument(file, owner);
      setSuccess('Documento enviado com sucesso.');
      setFile(null);
      form.reset();
      onUploaded();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setPending(false);
      onPendingChange(false);
    }
  }

  return (
    <section className="upload-section" aria-labelledby="upload-heading">
      <div className="section-heading">
        <h2 id="upload-heading">Novo documento</h2>
      </div>
      <form className="upload-form" onSubmit={handleSubmit} aria-busy={pending}>
        <div className="file-field">
          <label htmlFor="document-file">Arquivo</label>
          <input
            id="document-file"
            name="file"
            type="file"
            required
            disabled={!owner || pending}
            onChange={(event) => {
              setFile(event.target.files?.[0] || null);
              setError('');
              setSuccess('');
            }}
          />
        </div>
        <button className="primary-button" type="submit" disabled={!owner || !file || pending}>
          {pending ? <LoaderCircle className="spinning" size={18} aria-hidden="true" /> : <Upload size={18} aria-hidden="true" />}
          {pending ? 'Enviando…' : 'Enviar documento'}
        </button>
      </form>
      {error && <p className="error-message" role="alert">{error}</p>}
      {success && <p className="success-message" role="status">{success}</p>}
    </section>
  );
}