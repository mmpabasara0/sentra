# NovaMart Supabase Confirmation Email Template

Use this in Supabase Dashboard:

1. Open Authentication > Email Templates.
2. Select Confirm signup.
3. Set the subject to:

```text
Confirm your NovaMart account
```

4. Paste this HTML into the message editor.

Supabase variables used here:
- `{{ .ConfirmationURL }}`: the one-time verification link.
- `{{ .Email }}`: the registering user's email.
- `{{ .SiteURL }}`: the configured application site URL.

```html
<!doctype html>
<html>
  <body style="margin:0;background:#07100d;padding:32px 16px;font-family:Inter,Arial,sans-serif;color:#eaf7f0;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;margin:0 auto;background:#0d1513;border:1px solid #1e332b;border-radius:18px;overflow:hidden;">
      <tr>
        <td style="padding:28px 28px 12px;">
          <div style="display:inline-block;background:#35c37d;color:#06100c;border-radius:999px;padding:8px 12px;font-size:12px;font-weight:700;letter-spacing:.02em;">
            NovaMart account verification
          </div>
          <h1 style="margin:24px 0 8px;font-size:30px;line-height:1.15;color:#ffffff;">
            Confirm your email to start shopping.
          </h1>
          <p style="margin:0;color:#9fb4ab;font-size:15px;line-height:1.7;">
            We received a signup request for <strong style="color:#ffffff;">{{ .Email }}</strong>. Confirm your email address to activate your NovaMart account.
          </p>
        </td>
      </tr>
      <tr>
        <td style="padding:12px 28px 28px;">
          <a href="{{ .ConfirmationURL }}" style="display:block;text-align:center;background:#35c37d;color:#07100d;text-decoration:none;border-radius:12px;padding:15px 18px;font-weight:800;font-size:15px;">
            Confirm email address
          </a>
          <p style="margin:20px 0 0;color:#9fb4ab;font-size:13px;line-height:1.7;">
            This secure link can only be used once. If you did not create a NovaMart account, you can ignore this email.
          </p>
          <p style="margin:18px 0 0;color:#71877d;font-size:12px;line-height:1.7;">
            Button not working? Copy and paste this link into your browser:<br>
            <span style="word-break:break-all;color:#c8d8d0;">{{ .ConfirmationURL }}</span>
          </p>
        </td>
      </tr>
      <tr>
        <td style="border-top:1px solid #1e332b;padding:18px 28px;color:#71877d;font-size:12px;">
          NovaMart runs locally for the Sentra final year project demo. Site URL: {{ .SiteURL }}
        </td>
      </tr>
    </table>
  </body>
</html>
```

For local demos, also set Authentication > URL Configuration:

```text
Site URL: http://localhost:3000
Redirect URLs: http://localhost:3000/**
```
