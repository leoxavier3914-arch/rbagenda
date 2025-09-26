import CheckoutPage from '@/components/CheckoutPage'

type CheckoutRouteProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function CheckoutRoute({ searchParams }: CheckoutRouteProps){
  const resolvedParams = await searchParams
  const clientSecretParam = resolvedParams.client_secret
  const appointmentIdParam = resolvedParams.appointment_id
  const clientSecret = typeof clientSecretParam === 'string' ? clientSecretParam : ''
  const appointmentId = typeof appointmentIdParam === 'string' ? appointmentIdParam : undefined

  return <CheckoutPage clientSecret={clientSecret} appointmentId={appointmentId} />
}
