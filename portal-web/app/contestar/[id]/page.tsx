type Props = { params: { id: string } };

export default function ContestarPublicPage({ params }: Props) {
  return (
    <div className="max-w-3xl mx-auto py-10 space-y-4">
      <h1 className="text-2xl font-semibold">Contestação pública #{params.id}</h1>
      <p className="text-sm text-muted-foreground">
        Página pública para acompanhamento/envio de contestação — placeholder.
      </p>
    </div>
  );
}
