const LABEL = {
  pending: 'Menunggu Verifikasi',
  verified: 'Terverifikasi',
  rejected: 'Ditolak'
}

export default function StatusBadge({ status }) {
  return <span className={`badge ${status}`}>{LABEL[status] || status}</span>
}
