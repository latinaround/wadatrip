import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function CheckoutIntro() {
  const navigate = useNavigate();

  const handleCheckout = async () => {
    try {
      const response = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const { url } = await response.json();
      if (url) {
        window.location.href = url;
      } else {
        alert("We could not start checkout right now.");
      }
    } catch (error) {
      console.error("Stripe checkout error:", error);
      alert("Checkout is temporarily unavailable. Please try again later.");
    }
  };

  return (
    <section className="flex flex-col items-center justify-center min-h-screen bg-[#0a0e27] text-white">
      <h1 className="text-4xl font-bold mb-6 neon-title">Confirm your booking</h1>
      <p className="mb-8 text-[#a0a0a0] text-lg">
        You'll be redirected to our secure Stripe page to complete your payment.
      </p>

      <div className="flex gap-4">
        <Button
          onClick={() => navigate("/")}
          className="bg-transparent border border-[#00D9FF]/30 text-[#00D9FF] hover:bg-white/5"
        >
           Back to Home
        </Button>

        <Button
          onClick={handleCheckout}
          className="neon-cta font-black hover:scale-105 transition-all"
        >
          Proceed to Payment
        </Button>
      </div>
    </section>
  );
}

