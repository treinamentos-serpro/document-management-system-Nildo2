import { useState } from 'react';
import { Download, LoaderCircle } from 'lucide-react';
import { downloadDocument } from '../services/documentApi.js';

export default function DownloadButton({ document, owner }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function handleDownload() {
    if (pending) return;
    setPending(true);
    setError('');
    let objectUrl;
    try {
      const blob = await downloadDocument(document.id, owner);
      objectUrl = URL.createObjectURL(blob);
      const link = window.document.createElement('a');
      link.href = objectUrl;
      link.download = document.originalName.replace(/[\\/\x00-\x1f\x7f]/g, '_') || 'documento';
      window.document.body.append(link);
      link.click();
      link.remove();
    } catch (failure) {
      setError(failure.message);
    } finally {
      if (objectUrl) window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      setPending(false);
    }
  }

  return (
    <div className="download-action">
      <button
        className="icon-button"
        type="button"
        title={pending ? 'Baixando documento' : 'Baixar documento'}
        aria-label={`Baixar ${document.originalName}`}
        aria-busy={pending}
        disabled={pending || !owner}
        onClick={handleDownload}
      >
        {pending ? <LoaderCircle className="spinning" size={19} aria-hidden="true" /> : <Download size={19} aria-hidden="true" />}
      </button>
      {error && <p className="error-message" role="alert">{error}</p>}
    </div>
  );
}