import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";

export default function MercadoLivreCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    // Simulate capturing the code parameter from URL
    const code = searchParams.get('code');
    console.log('Mercado Livre callback - Code captured:', code);

    // Simulate API call delay
    const timer = setTimeout(() => {
      // Redirect to integrations page after 2 seconds
      navigate('/integrations');
    }, 2000);

    return () => clearTimeout(timer);
  }, [navigate, searchParams]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-6 animate-fade-in">
        {/* Loading icon with spin animation */}
        <div className="flex justify-center">
          <Loader2 className="h-12 w-12 text-primary animate-spin" />
        </div>
        
        {/* Loading text */}
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-foreground">
            Conectando com o Mercado Livre...
          </h1>
          <p className="text-muted-foreground">
            Aguarde enquanto configuramos sua integração
          </p>
        </div>

        {/* Progress indicator dots */}
        <div className="flex justify-center space-x-2">
          <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
          <div className="w-2 h-2 bg-primary rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
          <div className="w-2 h-2 bg-primary rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
        </div>
      </div>
    </div>
  );
}