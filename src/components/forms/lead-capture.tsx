"use client";

import { useState, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";

// =============================================================================
// Lead Capture Form
// Multi-step form with validation, industry selection, and submit handling.
// Designed for SaaS landing pages and demo request flows.
// =============================================================================

// --- Types ---

interface LeadFormData {
  name: string;
  email: string;
  company: string;
  jobTitle: string;
  phone: string;
  companySize: string;
  industry: string;
  message: string;
  source: string;
}

interface FieldError {
  field: keyof LeadFormData;
  message: string;
}

interface LeadCaptureProps {
  variant?: "inline" | "modal" | "full-page";
  source?: string;
  title?: string;
  subtitle?: string;
  submitLabel?: string;
  showPhone?: boolean;
  showMessage?: boolean;
  showCompanySize?: boolean;
  redirectTo?: string;
  onSuccess?: (data: LeadFormData) => void;
  className?: string;
}

// --- Constants ---

const COMPANY_SIZES = [
  { value: "1-10", label: "1-10 employees" },
  { value: "11-50", label: "11-50 employees" },
  { value: "51-200", label: "51-200 employees" },
  { value: "201-1000", label: "201-1,000 employees" },
  { value: "1001+", label: "1,000+ employees" },
];

const INDUSTRIES = [
  "Technology",
  "Finance & Banking",
  "Healthcare",
  "E-Commerce",
  "Education",
  "Manufacturing",
  "Real Estate",
  "Marketing & Advertising",
  "Consulting",
  "Other",
];

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const FREE_EMAIL_DOMAINS = ["gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "aol.com"];

// --- Validation ---

function validateForm(data: LeadFormData): FieldError[] {
  const errors: FieldError[] = [];

  if (!data.name.trim()) {
    errors.push({ field: "name", message: "Name is required" });
  }

  if (!data.email.trim()) {
    errors.push({ field: "email", message: "Email is required" });
  } else if (!EMAIL_REGEX.test(data.email)) {
    errors.push({ field: "email", message: "Please enter a valid email" });
  } else {
    const domain = data.email.split("@")[1];
    if (FREE_EMAIL_DOMAINS.includes(domain)) {
      errors.push({ field: "email", message: "Please use your work email" });
    }
  }

  if (!data.company.trim()) {
    errors.push({ field: "company", message: "Company name is required" });
  }

  return errors;
}


// --- Component ---

export default function LeadCaptureForm({
  variant = "inline",
  source = "website",
  title = "Get Started",
  subtitle = "Fill out the form below and we will be in touch shortly.",
  submitLabel = "Request Demo",
  showPhone = false,
  showMessage = true,
  showCompanySize = true,
  redirectTo,
  onSuccess,
  className = "",
}: LeadCaptureProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [formData, setFormData] = useState<LeadFormData>({
    name: "",
    email: "",
    company: "",
    jobTitle: "",
    phone: "",
    companySize: "",
    industry: "",
    message: "",
    source,
  });

  const [errors, setErrors] = useState<FieldError[]>([]);
  const [submitStatus, setSubmitStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [touched, setTouched] = useState<Set<string>>(new Set());

  const updateField = useCallback((field: keyof LeadFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => prev.filter((e) => e.field !== field));
  }, []);

  const handleBlur = useCallback((field: string) => {
    setTouched((prev) => new Set(prev).add(field));
  }, []);

  const getFieldError = useCallback(
    (field: keyof LeadFormData) => {
      if (!touched.has(field)) return null;
      return errors.find((e) => e.field === field)?.message ?? null;
    },
    [errors, touched]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Mark all fields as touched
    setTouched(new Set(Object.keys(formData)));

    const validationErrors = validateForm(formData);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    setSubmitStatus("loading");

    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error("Failed to submit lead");
      }

      setSubmitStatus("success");
      onSuccess?.(formData);

      if (redirectTo) {
        startTransition(() => router.push(redirectTo));
      }
    } catch {
      setSubmitStatus("error");
    }
  };
  // Variant-specific container classes
  const containerClasses = {
    inline: "w-full max-w-md",
    modal: "w-full max-w-lg p-6",
    "full-page": "w-full max-w-2xl mx-auto py-12 px-4",
  };

  if (submitStatus === "success") {
    return (
      <div className={`${containerClasses[variant]} ${className}`}>
        <div className="rounded-lg border border-green-200 bg-green-50 p-6 text-center">
          <svg
            className="mx-auto h-12 w-12 text-green-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
          <h3 className="mt-4 text-lg font-semibold text-green-800">
            Thank you for your interest!
          </h3>
          <p className="mt-2 text-sm text-green-600">
            We'll be in touch within 24 hours.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`${containerClasses[variant]} ${className}`}>
      {title && (
        <div className="mb-6">
          <h2 className="text-2xl font-bold tracking-tight text-gray-900">
            {title}
          </h2>
          {subtitle && (
            <p className="mt-2 text-sm text-gray-600">{subtitle}</p>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {/* Name field */}
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700">
            Full Name <span className="text-red-500">*</span>
          </label>
          <input
            id="name"
            type="text"
            value={formData.name}
            onChange={(e) => updateField("name", e.target.value)}
            onBlur={() => handleBlur("name")}
            placeholder="John Smith"
            className={`mt-1 block w-full rounded-md border px-3 py-2 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              getFieldError("name")
                ? "border-red-300 focus:border-red-500 focus:ring-red-500"
                : "border-gray-300 focus:border-blue-500"
            }`}
          />
          {getFieldError("name") && (
            <p className="mt-1 text-xs text-red-600">{getFieldError("name")}</p>
          )}
        </div>

        {/* Email field */}
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">
            Work Email <span className="text-red-500">*</span>
          </label>
          <input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => updateField("email", e.target.value)}
            onBlur={() => handleBlur("email")}
            placeholder="john@company.com"
            className={`mt-1 block w-full rounded-md border px-3 py-2 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              getFieldError("email")
                ? "border-red-300 focus:border-red-500 focus:ring-red-500"
                : "border-gray-300 focus:border-blue-500"
            }`}
          />
          {getFieldError("email") && (
            <p className="mt-1 text-xs text-red-600">{getFieldError("email")}</p>
          )}
        </div>

        {/* Company field */}
        <div>
          <label htmlFor="company" className="block text-sm font-medium text-gray-700">
            Company <span className="text-red-500">*</span>
          </label>
          <input
            id="company"
            type="text"
            value={formData.company}
            onChange={(e) => updateField("company", e.target.value)}
            onBlur={() => handleBlur("company")}
            placeholder="Acme Corp"
            className={`mt-1 block w-full rounded-md border px-3 py-2 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              getFieldError("company")
                ? "border-red-300 focus:border-red-500 focus:ring-red-500"
                : "border-gray-300 focus:border-blue-500"
            }`}
          />
          {getFieldError("company") && (
            <p className="mt-1 text-xs text-red-600">{getFieldError("company")}</p>
          )}
        </div>
        {/* Job Title field */}
        <div>
          <label htmlFor="jobTitle" className="block text-sm font-medium text-gray-700">
            Job Title
          </label>
          <input
            id="jobTitle"
            type="text"
            value={formData.jobTitle}
            onChange={(e) => updateField("jobTitle", e.target.value)}
            placeholder="VP of Sales"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Phone field (conditional) */}
        {showPhone && (
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
              Phone Number
            </label>
            <input
              id="phone"
              type="tel"
              value={formData.phone}
              onChange={(e) => updateField("phone", e.target.value)}
              placeholder="+1 (555) 123-4567"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}

        {/* Company Size (conditional) */}
        {showCompanySize && (
          <div>
            <label htmlFor="companySize" className="block text-sm font-medium text-gray-700">
              Company Size
            </label>
            <select
              id="companySize"
              value={formData.companySize}
              onChange={(e) => updateField("companySize", e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select company size</option>
              {COMPANY_SIZES.map((size) => (
                <option key={size.value} value={size.value}>
                  {size.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Industry select */}
        <div>
          <label htmlFor="industry" className="block text-sm font-medium text-gray-700">
            Industry
          </label>
          <select
            id="industry"
            value={formData.industry}
            onChange={(e) => updateField("industry", e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select industry</option>
            {INDUSTRIES.map((industry) => (
              <option key={industry} value={industry}>
                {industry}
              </option>
            ))}
          </select>
        </div>
        {/* Message field (conditional) */}
        {showMessage && (
          <div>
            <label htmlFor="message" className="block text-sm font-medium text-gray-700">
              How can we help?
            </label>
            <textarea
              id="message"
              value={formData.message}
              onChange={(e) => updateField("message", e.target.value)}
              placeholder="Tell us about your needs..."
              rows={4}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
        )}

        {/* Error message */}
        {submitStatus === "error" && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3">
            <p className="text-sm text-red-700">
              Something went wrong. Please try again or contact us directly.
            </p>
          </div>
        )}

        {/* Submit button */}
        <button
          type="submit"
          disabled={submitStatus === "loading" || isPending}
          className="w-full rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitStatus === "loading" || isPending ? (
            <span className="flex items-center justify-center gap-2">
              <svg
                className="h-4 w-4 animate-spin"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Submitting...
            </span>
          ) : (
            submitLabel
          )}
        </button>

        {/* Privacy notice */}
        <p className="text-center text-xs text-gray-500">
          By submitting, you agree to our{" "}
          <a href="/privacy" className="underline hover:text-gray-700">
            Privacy Policy
          </a>
          . We will never share your information.
        </p>
      </form>
    </div>
  );
}

export default LeadCaptureForm;
