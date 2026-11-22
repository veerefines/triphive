import { Navigate } from 'react-router-dom'

/** Old scaffold route — the app's home is the trips list. */
export default function HomeRedirect() {
  return <Navigate to="/trips" replace />
}
