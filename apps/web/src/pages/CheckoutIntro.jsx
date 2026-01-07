import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function CheckoutIntro() {
  const navigate = useNavigate();

  const handleCheckout = async () => {
    try {
      // Llama a tu endpoint del backend para crear la sesión de Stripe
      const response = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const { url } = await response.json();
      if (url) {
        window.location.href = url; // redirige a la página de Stripe
      } else {
        alert("Error: could not start payment session");
      }
    } catch (error) {
      console.error("Stripe checkout error:", error);
      alert("Something went wrong, please try again later.");
    }
  };

  return (
    <section className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-orange-900 via-orange-700 to-orange-500 text-white">
      <h1 className="text-4xl font-bold mb-6">Confirm your booking</h1>
      <p className="mb-8 text-orange-100 text-lg">
        You’ll be redirected to our secure Stripe page to complete your payment.
      </p>

      <div className="flex gap-4">
        <Button
          onClick={() => navigate("/")}
          className="border border-white bg-transparent text-white hover:bg-orange-600"
        >
          ← Back to Home
        </Button>

        <Button
          onClick={handleCheckout}
          className="bg-white text-orange-700 hover:bg-orange-100"
        >
          Proceed to Payment
        </Button>
      </div>
    </section>
  );
}
