import { FileText, LoaderCircle } from 'lucide-react';
import DownloadButton from './DownloadButton.jsx';

const dateFormatter = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
const numberFormatter = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${numberFormatter.format(bytes / 1024)} KB`;
  return `${numberFormatter.format(bytes / (1024 * 1024))} MB`;
}

export default function DocumentList({ documents, owner, loading, error }) {
  if (!owner) return <p className="empty-state">Nenhum usuário selecionado.</p>;
  if (loading) return <p className="empty-state" role="status"><LoaderCircle className="spinning" size={20} aria-hidden="true" /> Carregando documentos…</p>;
  if (error) return <p className="error-message" role="alert">{error}</p>;
  if (!documents.length) return <p className="empty-state">Nenhum documento enviado.</p>;

  return (
    <table className="document-table">
      <caption className="visually-hidden">Documentos de {owner}</caption>
      <thead>
        <tr><th scope="col">Documento</th><th scope="col">Tamanho</th><th scope="col">Enviado em</th><th scope="col"><span className="visually-hidden">Download</span></th></tr>
      </thead>
      <tbody>
        {documents.map((document) => (
          <tr key={document.id}>
            <td className="document-name"><FileText size={21} aria-hidden="true" /><span>{document.originalName}</span></td>
            <td className="document-size">{formatSize(document.size)}</td>
            <td className="document-date"><time dateTime={document.uploadedAt}>{dateFormatter.format(new Date(document.uploadedAt))}</time></td>
            <td className="document-download"><DownloadButton document={document} owner={owner} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}