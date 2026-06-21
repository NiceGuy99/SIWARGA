export default function LoadingScreen({ label = 'Memuat...' }) {
  return (
    <div className="center-screen">
      <div className="muted">{label}</div>
    </div>
  )
}
