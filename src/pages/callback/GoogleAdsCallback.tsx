import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";

export default function GoogleAdsCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    // Google Ads OAuth uses a redirect-based flow via the edge function.
    // The edge function (google-ads-auth) handles token exchange and redirects
    // back to /app/integrations with status params.
    // If we land here, it means something unexpected happened.
    // Redirect to integrations page after a short delay.
    const timer = setTimeout(() => {
      navigate('/app/integrations?status=error&message=unexpected_callback');
    }, 3000);

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-6 animate-fade-in">
        <div className="flex justify-center">
          <Loader2 className="h-12 w-12 text-primary animate-spin" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-foreground">
            Conectando com o Google Ads...
          </h1>
          <p className="text-muted-foreground">
            Aguarde enquanto configuramos sua integração
          </p>
        </div>
        <div className="flex justify-center space-x-2">
          <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
          <div className="w-2 h-2 bg-primary rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
          <div className="w-2 h-2 bg-primary rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
        </div>
      </div>
    </div>
  );
}