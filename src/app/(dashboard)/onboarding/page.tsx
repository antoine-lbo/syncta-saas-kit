"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";

const STEPS = [
  { id: "org", title: "Create your organization", description: "Set up your team workspace" },
  { id: "invite", title: "Invite your team", description: "Add team members to get started" },
  { id: "plan", title: "Choose a plan", description: "Select the plan that fits your needs" },
];

const PLANS = [
  {
    name: "Starter",
    price: "$0",
    period: "forever",
    features: ["Up to 3 team members", "1,000 API calls/month", "Community support", "Basic analytics"],
    priceId: null,
  },
  {
    name: "Pro",
    price: "$29",
    period: "/month",
    features: ["Up to 20 team members", "50,000 API calls/month", "Priority support", "Advanced analytics", "Custom integrations"],
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID,
    popular: true,
  },
  {
    name: "Enterprise",
    price: "$99",
    period: "/month",
    features: ["Unlimited team members", "Unlimited API calls", "Dedicated support", "SSO & SAML", "Custom SLAs", "On-premise option"],
    priceId: process.env.NEXT_PUBLIC_STRIPE_ENTERPRISE_PRICE_ID,
  },
];

export default function OnboardingPage() {
  const [currentStep, setCurrentStep] = useState(0);
  const [orgName, setOrgName] = useState("");
  const [orgSlug, setOrgSlug] = useState("");
  const [inviteEmails, setInviteEmails] = useState("");
  const [selectedPlan, setSelectedPlan] = useState("Starter");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const generateSlug = (name: string) => {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  };

  const handleOrgNameChange = (value: string) => {
    setOrgName(value);
    setOrgSlug(generateSlug(value));
  };

  const handleCreateOrg = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: org, error } = await supabase
      .from("organizations")
      .insert({ name: orgName, slug: orgSlug })
      .select()
      .single();

    if (error) {
      console.error("Failed to create organization:", error);
      setLoading(false);
      return;
    }

    // Add current user as admin
    await supabase.from("organization_members").insert({
      organization_id: org.id,
      user_id: user.id,
      role: "admin",
    });

    setLoading(false);
    setCurrentStep(1);
  };

  const handleInvite = async () => {
    const emails = inviteEmails.split(",").map((e) => e.trim()).filter(Boolean);
    if (emails.length === 0) {
      setCurrentStep(2);
      return;
    }

    setLoading(true);
    // Send invites via API
    await fetch("/api/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emails }),
    });
    setLoading(false);
    setCurrentStep(2);
  };

  const handleComplete = async () => {
    setLoading(true);
    const plan = PLANS.find((p) => p.name === selectedPlan);

    if (plan?.priceId) {
      // Redirect to Stripe checkout for paid plans
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId: plan.priceId }),
      });
      const { url } = await res.json();
      window.location.href = url;
    } else {
      router.push("/dashboard");
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
      <div className="w-full max-w-2xl">
        {/* Progress Steps */}
        <div className="flex items-center justify-center mb-12">
          {STEPS.map((step, i) => (
            <div key={step.id} className="flex items-center">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium ${
                i <= currentStep
                  ? "bg-blue-600 text-white"
                  : "bg-zinc-800 text-zinc-500"
              }`}>
                {i < currentStep ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  i + 1
                )}
              </div>
              {i < STEPS.length - 1 && (
                <div className={`w-24 h-0.5 mx-2 ${i < currentStep ? "bg-blue-600" : "bg-zinc-800"}`} />
              )}
            </div>
          ))}
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8">
          <h2 className="text-2xl font-bold text-white mb-2">
            {STEPS[currentStep].title}
          </h2>
          <p className="text-zinc-400 mb-8">{STEPS[currentStep].description}</p>

          {/* Step 1: Create Organization */}
          {currentStep === 0 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">Organization name</label>
                <input
                  type="text"
                  value={orgName}
                  onChange={(e) => handleOrgNameChange(e.target.value)}
                  placeholder="Acme Inc."
                  className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">URL slug</label>
                <div className="flex items-center gap-2">
                  <span className="text-zinc-500 text-sm">app.syncta.ai/</span>
                  <input
                    type="text"
                    value={orgSlug}
                    onChange={(e) => setOrgSlug(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <button
                onClick={handleCreateOrg}
                disabled={!orgName || loading}
                className="w-full py-2.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-500 disabled:opacity-50 transition-colors mt-4"
              >
                {loading ? "Creating..." : "Create organization"}
              </button>
            </div>
          )}

          {/* Step 2: Invite Team */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                  Team member emails
                </label>
                <textarea
                  value={inviteEmails}
                  onChange={(e) => setInviteEmails(e.target.value)}
                  placeholder="john@company.com, jane@company.com"
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-zinc-500 mt-1">Separate emails with commas</p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setCurrentStep(2)}
                  className="flex-1 py-2.5 rounded-lg bg-zinc-800 text-zinc-300 font-medium hover:bg-zinc-700 transition-colors"
                >
                  Skip for now
                </button>
                <button
                  onClick={handleInvite}
                  disabled={loading}
                  className="flex-1 py-2.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-500 disabled:opacity-50 transition-colors"
                >
                  {loading ? "Sending..." : "Send invites"}
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Choose Plan */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                {PLANS.map((plan) => (
                  <button
                    key={plan.name}
                    onClick={() => setSelectedPlan(plan.name)}
                    className={`p-4 rounded-xl border text-left transition-all ${
                      selectedPlan === plan.name
                        ? "border-blue-500 bg-blue-500/10"
                        : "border-zinc-700 bg-zinc-800 hover:border-zinc-600"
                    }`}
                  >
                    {plan.popular && (
                      <span className="text-xs font-medium text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded-full">
                        Most popular
                      </span>
                    )}
                    <div className="mt-2">
                      <p className="text-lg font-semibold text-white">{plan.name}</p>
                      <p className="text-2xl font-bold text-white mt-1">
                        {plan.price}
                        <span className="text-sm text-zinc-400 font-normal">{plan.period}</span>
                      </p>
                    </div>
                    <ul className="mt-4 space-y-2">
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex items-center gap-2 text-sm text-zinc-300">
                          <svg className="w-4 h-4 text-green-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </button>
                ))}
              </div>
              <button
                onClick={handleComplete}
                disabled={loading}
                className="w-full py-2.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-500 disabled:opacity-50 transition-colors mt-4"
              >
                {loading ? "Setting up..." : selectedPlan === "Starter" ? "Start for free" : `Subscribe to ${selectedPlan}`}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
