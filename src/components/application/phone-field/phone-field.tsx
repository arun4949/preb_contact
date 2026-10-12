"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type KeyboardEvent, type SVGProps } from "react";
import * as Flags from "country-flag-icons/react/3x2";
import type { CountryCode } from "libphonenumber-js/min";
import { Input, type InputSize } from "@/components/base/input/input";
import { Select, SelectItem } from "@/components/base/select/select";
import { PHONE_COUNTRIES, formatAsYouType, formatPhoneNational, normalizePhone, toPhoneCountry } from "@/lib/phone/phone";
import { cx } from "@/utils/cx";

/**
 * BoardUI "phone" recipe: the country selector (flag + dial code) sits in the
 * Input's leading addon slot and the number formats as you type.
 *
 * Two uses:
 *   - onboarding form: uncontrolled from the form's point of view. The visible
 *     `<input name="phone">` submits the raw text and the hidden `<select
 *     name="phone_country">` the ISO code; the server action normalises. The
 *     field only reports validity (`onValidityChange`) so the form can hold a
 *     submit with an invalid number.
 *   - settings row: `onCommit(raw, country)` fires on Enter, on blur (unless
 *     focus moved to the country trigger) and on a country change while digits
 *     are present, mirroring the Full name field.
 *
 * Validation is `aria` so the BoardUI hint shows instead of the browser bubble.
 */

export interface PhoneFieldProps {
  name?: string;
  countryName?: string;
  label?: string;
  hint?: string;
  placeholder?: string;
  size?: InputSize;
  /** Stored E.164 number, shown in national format. */
  defaultValue?: string | null;
  defaultCountry?: string;
  isDisabled?: boolean;
  /** Error coming back from the server; overrides the local check. */
  errorMessage?: string | null;
  onValidityChange?: (valid: boolean) => void;
  onCommit?: (raw: string, country: CountryCode) => void;
  className?: string;
  fieldClassName?: string;
  "aria-label"?: string;
}

type FlagComponent = ComponentType<SVGProps<SVGSVGElement>>;

function Flag({ iso2, className }: { iso2: CountryCode; className?: string }) {
  const Component = (Flags as Record<string, FlagComponent>)[iso2];
  if (!Component) return null;
  return <Component className={cx("h-3 w-4 shrink-0 rounded-[2px]", className)} aria-hidden />;
}

export function PhoneField({
  name = "phone",
  countryName = "phone_country",
  label,
  hint,
  placeholder,
  size = "medium",
  defaultValue,
  defaultCountry,
  isDisabled = false,
  errorMessage,
  onValidityChange,
  onCommit,
  className,
  fieldClassName,
  "aria-label": ariaLabel,
}: PhoneFieldProps) {
  const initialCountry = useMemo(
    () => (defaultValue ? (normalizePhone(defaultValue, toPhoneCountry(defaultCountry))?.country ?? toPhoneCountry(defaultCountry)) : toPhoneCountry(defaultCountry)),
    [defaultValue, defaultCountry],
  );
  const [country, setCountry] = useState<CountryCode>(initialCountry);
  const [text, setText] = useState(() => (defaultValue ? formatPhoneNational(defaultValue) : ""));
  const [touched, setTouched] = useState(false);
  const committed = useRef({ text: defaultValue ? formatPhoneNational(defaultValue) : "", country: initialCountry });
  const triggerRef = useRef<HTMLDivElement>(null);

  const valid = text.trim() === "" || normalizePhone(text, country) !== null;
  const showError = Boolean(errorMessage) || (touched && !valid);
  const countryLabel = PHONE_COUNTRIES.find((c) => c.iso2 === country)?.name ?? country;

  useEffect(() => {
    onValidityChange?.(valid);
  }, [valid, onValidityChange]);

  const commit = useCallback(
    (nextText: string, nextCountry: CountryCode) => {
      if (!onCommit) return;
      if (nextText.trim() === committed.current.text.trim() && nextCountry === committed.current.country) return;
      if (nextText.trim() !== "" && !normalizePhone(nextText, nextCountry)) return;
      committed.current = { text: nextText, country: nextCountry };
      onCommit(nextText, nextCountry);
    },
    [onCommit],
  );

  const handleChange = (value: string) => {
    const { text: formatted, detectedCountry } = formatAsYouType(value, country);
    // Keep the raw text while deleting so backspace does not fight the formatter.
    const next = value.length < text.length ? value : formatted;
    setText(next);
    if (detectedCountry && detectedCountry !== country) setCountry(detectedCountry);
  };

  const handleCountryChange = (next: CountryCode) => {
    if (next === country) return;
    setCountry(next);
    const digits = text.replace(/\D/g, "");
    const reformatted = digits ? formatAsYouType(digits, next).text : "";
    setText(reformatted);
    if (digits) commit(reformatted, next);
  };

  const handleBlur = (event: React.FocusEvent<HTMLInputElement>) => {
    setTouched(true);
    const to = event.relatedTarget as Node | null;
    if (to && triggerRef.current?.contains(to)) return;
    commit(text, country);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && onCommit) {
      event.preventDefault();
      setTouched(true);
      commit(text, country);
      (event.target as HTMLInputElement).blur();
    }
  };

  return (
    <Input
      name={name}
      type="tel"
      inputMode="tel"
      autoComplete="tel-national"
      label={label}
      aria-label={ariaLabel}
      placeholder={placeholder}
      size={size}
      value={text}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      isDisabled={isDisabled}
      isInvalid={showError}
      validationBehavior="aria"
      hint={showError ? (errorMessage ?? `Enter a valid phone number for ${countryLabel}.`) : hint}
      className={className}
      fieldClassName={fieldClassName}
      leadingAddon={
        <Select
          ref={triggerRef}
          aria-label="Country code"
          name={countryName}
          size="sm"
          selectedKey={country}
          onSelectionChange={(key) => handleCountryChange(String(key) as CountryCode)}
          isDisabled={isDisabled}
          triggerClassName={cx(
            "h-7 rounded-lg border-0 bg-transparent px-1.5 shadow-none",
            "hover:bg-background-secondary-hover focus-visible:ring-offset-0",
          )}
          popoverClassName="w-[280px]"
          renderValue={() => (
            <span className="flex items-center gap-1.5 text-body-2-medium text-text-primary" dir="ltr">
              <Flag iso2={country} />
              <span className="tabular-nums">+{PHONE_COUNTRIES.find((c) => c.iso2 === country)?.dial ?? ""}</span>
            </span>
          )}
        >
          {PHONE_COUNTRIES.map((c) => (
            <SelectItem key={c.iso2} id={c.iso2} textValue={c.name}>
              <Flag iso2={c.iso2} />
              <span className="min-w-0 flex-1 truncate">{c.name}</span>
              <span className="tabular-nums text-text-tertiary" dir="ltr">
                +{c.dial}
              </span>
            </SelectItem>
          ))}
        </Select>
      }
    />
  );
}
