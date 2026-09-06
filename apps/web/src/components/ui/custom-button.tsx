"use client";

import React from "react";

type ButtonVariant = "amber" | "purple";

interface CustomButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  variant?: ButtonVariant;
}

const CustomButton = ({ loading, className, variant = "amber", ...props }: CustomButtonProps) => {
  const gradientClasses =
    variant === "purple"
      ? "bg-gradient-to-br from-[#7c3aed] via-[#6d28d9] to-[#5b21b6] hover:shadow-[0_10px_30px_rgba(109,40,217,0.5)]"
      : "bg-gradient-to-br from-[#fde047] via-[#facc15] to-[#eab308] hover:shadow-[0_10px_30px_rgba(234,179,8,0.35)]";

  const textColor = variant === "purple" ? "text-white" : "text-gray-900";

  return (
    <button
      {...props}
      disabled={loading || props.disabled}
      className={`
                w-[328px]
                h-[56px]
                rounded-2xl
                capitalize
                font-semibold
                relative
                text-lg
                ${gradientClasses}
                ${textColor}
                transition-all duration-300 ease-in-out
                hover:-translate-y-0.5
                disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0
                ${className || ""}
            `}
    >
      {loading ? (
        <span className="inline-block size-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : (
        props.children
      )}
    </button>
  );
};

export default CustomButton;
