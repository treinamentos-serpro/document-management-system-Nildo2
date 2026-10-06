async function request(path, owner, options = {}) {
  let response;
  try {
    response = await fetch(`/api${path}`, {
      ...options,
      headers: { 'X-User-Id': owner.trim() },
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new Error('Não foi possível conectar ao servidor.');
  }

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error?.message || 'Não foi possível concluir a operação.');
  }
  return response;
}

export async function listDocuments(owner, signal) {
  const response = await request('/documents', owner, { signal });
  const body = await response.json();
  return body.data;
}

export async function uploadDocument(file, owner) {
  const form = new FormData();
  form.append('file', file);
  const response = await request('/upload', owner, { method: 'POST', body: form });
  const body = await response.json();
  return body.data;
}

export async function downloadDocument(id, owner) {
  const response = await request(`/documents/${encodeURIComponent(id)}/download`, owner);
  return response.blob();
}