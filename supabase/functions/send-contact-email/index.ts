import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ContactEmailRequest {
  name: string;
  email: string;
  subject: string;
  message: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { name, email, subject, message }: ContactEmailRequest = await req.json();

    // Validation
    if (!name || !email || !subject || !message) {
      console.error("Missing required fields:", { name: !!name, email: !!email, subject: !!subject, message: !!message });
      return new Response(
        JSON.stringify({ error: "Todos os campos são obrigatórios" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.error("Invalid email format:", email);
      return new Response(
        JSON.stringify({ error: "Email inválido" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("Sending contact email from:", name, email);

    // Send email to UNISTOCK
    const emailResponse = await resend.emails.send({
      from: "UNISTOCK Contact <onboarding@resend.dev>",
      to: ["unistockenterprise@gmail.com"],
      subject: `[Contato UNISTOCK] ${subject}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #DF8F06;">Nova Mensagem de Contato - UNISTOCK</h2>
          <hr style="border: 1px solid #DF8F06;" />
          
          <p><strong>Nome:</strong> ${name}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Assunto:</strong> ${subject}</p>
          
          <h3 style="color: #344966;">Mensagem:</h3>
          <div style="background-color: #f5f5f5; padding: 15px; border-radius: 8px;">
            <p style="white-space: pre-wrap;">${message}</p>
          </div>
          
          <hr style="border: 1px solid #eee; margin-top: 20px;" />
          <p style="color: #666; font-size: 12px;">
            Este email foi enviado através do formulário de contato do site UNISTOCK.
          </p>
        </div>
      `,
    });

    console.log("Email sent successfully:", emailResponse);

    // Send confirmation email to user
    await resend.emails.send({
      from: "UNISTOCK <onboarding@resend.dev>",
      to: [email],
      subject: "Recebemos sua mensagem - UNISTOCK",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #DF8F06;">Olá ${name}!</h2>
          
          <p>Recebemos sua mensagem e nossa equipe irá analisá-la em breve.</p>
          <p>Entraremos em contato o mais rápido possível.</p>
          
          <div style="background-color: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Sua mensagem:</strong></p>
            <p style="color: #666;">${message}</p>
          </div>
          
          <p>Enquanto isso, você também pode nos contatar:</p>
          <ul>
            <li>WhatsApp: <a href="https://wa.me/5512996872975">+55 12 99687-2975</a></li>
            <li>Instagram: <a href="https://instagram.com/oficialunistock">@oficialunistock</a></li>
          </ul>
          
          <hr style="border: 1px solid #eee; margin-top: 20px;" />
          <p style="color: #666; font-size: 12px;">
            Atenciosamente,<br/>
            Equipe UNISTOCK
          </p>
        </div>
      `,
    });

    console.log("Confirmation email sent to user:", email);

    return new Response(
      JSON.stringify({ success: true, message: "Email enviado com sucesso!" }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in send-contact-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro ao enviar email" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
