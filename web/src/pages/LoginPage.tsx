import { FormEvent, ReactNode, useEffect, useState } from "react";
import QRCode from "qrcode";
import {
  confirmResetPassword, confirmSignIn, resetPassword, signIn, signOut, type SignInOutput,
} from "aws-amplify/auth";

const ENV = import.meta.env.VITE_ENVIRONMENT ?? "dev";
const PASSWORD_RULES = "At least 14 characters, with upper- and lowercase letters, a number and a symbol.";

type Step =
  | { kind: "signIn" }
  | { kind: "newPassword" }
  | { kind: "totpSetup"; uri: string; secret: string }
  | { kind: "totpCode" }
  | { kind: "forgot" }
  | { kind: "forgotConfirm" };

function message(e: unknown): string {
  const name = (e as { name?: string })?.name;
  switch (name) {
    case "NotAuthorizedException":
      return (e as Error).message.includes("disabled")
        ? "This account is disabled. Ask another operator to enable it."
        : "Wrong email or password.";
    case "CodeMismatchException":
      return "That code is wrong or has expired. Try the newest code from your app.";
    case "InvalidPasswordException":
      return `The password doesn't meet the rules. ${PASSWORD_RULES}`;
    case "LimitExceededException":
    case "TooManyRequestsException":
      return "Too many attempts. Wait a few minutes and try again.";
    case "ExpiredCodeException":
      return "The code has expired. Request a new one.";
    default:
      return e instanceof Error ? e.message : String(e);
  }
}

export default function LoginPage({ onSignedIn }: { onSignedIn: () => void }) {
  const [step, setStep] = useState<Step>({ kind: "signIn" });
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await fn();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }

  async function next(out: SignInOutput) {
    const s = out.nextStep.signInStep;
    switch (s) {
      case "DONE":
        onSignedIn();
        return;
      case "CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED":
        setStep({ kind: "newPassword" });
        return;
      case "CONTINUE_SIGN_IN_WITH_TOTP_SETUP": {
        const details = out.nextStep.totpSetupDetails;
        setStep({ kind: "totpSetup", uri: details.getSetupUri(`SBS Admin (${ENV})`, email).toString(),
                  secret: details.sharedSecret });
        return;
      }
      case "CONTINUE_SIGN_IN_WITH_MFA_SELECTION":
      case "CONTINUE_SIGN_IN_WITH_MFA_SETUP_SELECTION":
        // The pool only offers authenticator apps.
        await next(await confirmSignIn({ challengeResponse: "TOTP" }));
        return;
      case "CONFIRM_SIGN_IN_WITH_TOTP_CODE":
        setStep({ kind: "totpCode" });
        return;
      case "RESET_PASSWORD":
        await resetPassword({ username: email });
        setStep({ kind: "forgotConfirm" });
        setInfo("Your password must be reset. We've emailed you a code.");
        return;
      default:
        throw new Error(`Unsupported sign-in step: ${s}`);
    }
  }

  const back = () => {
    setError(null);
    setInfo(null);
    setStep({ kind: "signIn" });
  };

  return (
    <div className="auth">
      <aside className="auth__brand">
        <div className="brand auth__logo">SBS <span>Admin</span></div>
        <div>
          <p className="auth__lead">The operator console for every restaurant on the platform.</p>
          <p className="auth__sub">Customers, plans, domains and payments - in one place.</p>
        </div>
        <span className={`env env--${ENV}`}>{ENV}</span>
      </aside>

      <main className="auth__main">
        <div className="auth__card">
          {step.kind === "signIn" && (
            <Form title="Sign in" lead="Use your operator account." error={error} info={info}
                  onSubmit={(pw) => run(async () => {
                    try {
                      await next(await signIn({ username: email.trim().toLowerCase(), password: pw.password }));
                    } catch (e) {
                      if ((e as { name?: string })?.name === "UserAlreadyAuthenticatedException") {
                        await signOut();
                        await next(await signIn({ username: email.trim().toLowerCase(), password: pw.password }));
                      } else throw e;
                    }
                  })}
                  busy={busy} submit="Sign in"
                  footer={<button type="button" className="link" onClick={() => { setError(null); setStep({ kind: "forgot" }); }}>
                    Forgot your password?</button>}>
              <Input label="Email" name="email" type="email" autoComplete="username" value={email} onChange={setEmail} autoFocus />
              <Input label="Password" name="password" type="password" autoComplete="current-password" />
            </Form>
          )}

          {step.kind === "newPassword" && (
            <Form title="Choose your password" lead={`First sign-in: replace the temporary password. ${PASSWORD_RULES}`}
                  error={error} busy={busy} submit="Save password"
                  onSubmit={(v) => run(async () => {
                    if (v.password !== v.confirm) throw new Error("The passwords don't match.");
                    await next(await confirmSignIn({ challengeResponse: v.password }));
                  })}>
              <Input label="New password" name="password" type="password" autoComplete="new-password" autoFocus />
              <Input label="Repeat new password" name="confirm" type="password" autoComplete="new-password" />
            </Form>
          )}

          {step.kind === "totpSetup" && (
            <Form title="Set up two-step sign-in" error={error} busy={busy} submit="Verify and sign in"
                  lead="Scan the code with an authenticator app (Google Authenticator, 1Password, Microsoft Authenticator…), then enter the 6-digit code it shows."
                  onSubmit={(v) => run(async () => next(await confirmSignIn({ challengeResponse: v.code.trim() })))}>
              <Qr uri={step.uri} />
              <details className="auth__secret">
                <summary>Can't scan? Enter this key instead</summary>
                <code className="mono">{step.secret}</code>
              </details>
              <Input label="6-digit code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" autoFocus />
            </Form>
          )}

          {step.kind === "totpCode" && (
            <Form title="Enter your code" lead="Open your authenticator app and enter the 6-digit code for SBS Admin."
                  error={error} busy={busy} submit="Sign in"
                  onSubmit={(v) => run(async () => next(await confirmSignIn({ challengeResponse: v.code.trim() })))}
                  footer={<button type="button" className="link" onClick={back}>Back</button>}>
              <Input label="6-digit code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" autoFocus />
            </Form>
          )}

          {step.kind === "forgot" && (
            <Form title="Reset your password" lead="We'll email you a code to choose a new password."
                  error={error} busy={busy} submit="Send code"
                  onSubmit={() => run(async () => {
                    await resetPassword({ username: email.trim().toLowerCase() });
                    setStep({ kind: "forgotConfirm" });
                    setInfo("If that address has an operator account, a code is on its way.");
                  })}
                  footer={<button type="button" className="link" onClick={back}>Back to sign in</button>}>
              <Input label="Email" name="email" type="email" autoComplete="username" value={email} onChange={setEmail} autoFocus />
            </Form>
          )}

          {step.kind === "forgotConfirm" && (
            <Form title="Choose a new password" lead={PASSWORD_RULES} error={error} info={info} busy={busy}
                  submit="Save new password"
                  onSubmit={(v) => run(async () => {
                    if (v.password !== v.confirm) throw new Error("The passwords don't match.");
                    await confirmResetPassword({ username: email.trim().toLowerCase(), confirmationCode: v.code.trim(),
                                                 newPassword: v.password });
                    setStep({ kind: "signIn" });
                    setInfo("Password changed. Sign in with your new password.");
                  })}
                  footer={<button type="button" className="link" onClick={back}>Back to sign in</button>}>
              <Input label="Code from the email" name="code" inputMode="numeric" autoComplete="one-time-code" autoFocus />
              <Input label="New password" name="password" type="password" autoComplete="new-password" />
              <Input label="Repeat new password" name="confirm" type="password" autoComplete="new-password" />
            </Form>
          )}
        </div>
        <p className="auth__foot">Restricted to platform operators. Every action is logged.</p>
      </main>
    </div>
  );
}

function Form(props: {
  title: string;
  lead?: string;
  error: string | null;
  info?: string | null;
  busy: boolean;
  submit: string;
  onSubmit: (values: Record<string, string>) => void;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const handle = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const values = Object.fromEntries(
      [...new FormData(e.currentTarget).entries()].map(([k, v]) => [k, String(v)]),
    );
    props.onSubmit(values);
  };
  return (
    <form className="auth__form" onSubmit={handle} noValidate={false}>
      <h1>{props.title}</h1>
      {props.lead && <p className="muted auth__lead-text">{props.lead}</p>}
      {props.info && <div className="notice notice--ok" role="status">{props.info}</div>}
      {props.error && <div className="notice notice--error" role="alert">{props.error}</div>}
      {props.children}
      <button className="btn btn--primary auth__submit" disabled={props.busy}>
        {props.busy ? "Please wait…" : props.submit}
      </button>
      {props.footer && <div className="auth__links">{props.footer}</div>}
    </form>
  );
}

function Input(props: {
  label: string;
  name: string;
  type?: string;
  autoComplete?: string;
  autoFocus?: boolean;
  inputMode?: "numeric";
  pattern?: string;
  value?: string;
  onChange?: (v: string) => void;
}) {
  const { label, onChange, value, ...rest } = props;
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      <input className="input" required {...rest}
             {...(onChange ? { value, onChange: (e) => onChange(e.target.value) } : {})} />
    </label>
  );
}

function Qr({ uri }: { uri: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    QRCode.toDataURL(uri, { margin: 1, width: 200, color: { dark: "#1d2420", light: "#fffdf8" } }).then(setSrc);
  }, [uri]);
  return <div className="auth__qr">{src ? <img src={src} alt="QR code for your authenticator app" /> : "…"}</div>;
}
