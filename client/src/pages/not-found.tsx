import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

export default function NotFound() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md mx-auto glass border border-border">
        <CardContent className="pt-8 pb-6 flex flex-col items-center text-center space-y-4">
          <div className="text-5xl">🪫</div>
          <h1 className="text-2xl font-bold text-foreground">
            Oups, quelque chose s’est mal passé
          </h1>
          <p className="text-sm text-muted-foreground">
            La page que tu essaies d’ouvrir n’existe pas ou n’est plus disponible.
          </p>
          <Button
            className="mt-2"
            onClick={() => setLocation("/start")}
          >
            Retourner à l’accueil
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
