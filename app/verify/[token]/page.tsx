import Verification from "./verification";
export const dynamic = "force-dynamic";
export default async function Page({ params }: any) {
  const { token } = await params;
  return <Verification token={token} />;
}
