/**
 * Servicio de upload de imágenes.
 * Todas las subidas pasan por el backend Flask,
 * que se encarga de subirlas a Supabase Storage.
 */
import api from './api'

/**
 * Sube la foto de perfil del usuario autenticado.
 * @param {File} file
 * @returns {Promise<string>} URL pública de la imagen
 */
export async function uploadProfilePhoto(file) {
  const formData = new FormData()
  formData.append('file', file)
  const { data } = await api.post('/upload/profile-photo', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data.url
}

/**
 * Sube una foto a un listing específico.
 * @param {number} listingId
 * @param {File} file
 * @returns {Promise<object>} objeto photo { id, photo_url, order }
 */
export async function uploadListingPhoto(listingId, file) {
  const formData = new FormData()
  formData.append('file', file)
  const { data } = await api.post(`/upload/listing/${listingId}/photo`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data.photo
}

/**
 * Sube la foto de un grupo.
 * @param {number} groupId
 * @param {File} file
 * @returns {Promise<string>} URL pública de la imagen
 */
export async function uploadGroupPhoto(groupId, file) {
  const formData = new FormData()
  formData.append('file', file)
  const { data } = await api.post(`/upload/group/${groupId}/photo`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data.url
}

/**
 * Sube la selfie de verificación (bucket privado).
 * @param {File} file
 * @returns {Promise<void>}
 */
export async function uploadVerificationSelfie(file) {
  const formData = new FormData()
  formData.append('file', file)
  await api.post('/upload/verification-selfie', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}