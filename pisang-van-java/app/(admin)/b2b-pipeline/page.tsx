import { getServerSession } from "next-auth"
import { authOptions } from "@/src/features/auth/authOptions"
import { redirect } from "next/navigation"
import { getB2BDeals } from "@/src/features/crm/actions"
import B2BBoard from "./B2BBoard"

export const dynamic = "force-dynamic"

export default async function B2BPipelinePage() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "ADMIN") {
    redirect("/dashboard/login")
  }

  const deals = await getB2BDeals()

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">B2B CRM Pipeline</h1>
          <p className="text-gray-500 text-sm">Kelola prospek katering korporat</p>
        </div>
      </div>
      <B2BBoard initialDeals={deals} />
    </div>
  )
}
