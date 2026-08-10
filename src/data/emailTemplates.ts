// Email Templates for Marketing Campaigns
// Merge tags: {{first_name}}, {{last_name}}, {{full_name}}, {{email}}, {{phone}}, {{position}}, {{company_name}}
// Company tags: {{company_name}}, {{company_name_en}}, {{company_address}}, {{company_phone}}, {{company_email}}, {{company_website}}, {{company_tax_id}}

export interface EmailTemplate {
  id: string;
  name: string;
  nameTH: string;
  thumbnail: string;
  html: string;
}

export const emailTemplates: EmailTemplate[] = [
  {
    id: 'template-1',
    name: 'Professional Classic',
    nameTH: 'โปรเฟสชั่นแนลคลาสสิก',
    thumbnail: '🏢',
    html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{subject}}</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f5f5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f5;padding:20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="background-color:#1e40af;padding:30px;text-align:center;">
              <h1 style="color:#ffffff;margin:0;font-size:28px;">{{company_name}}</h1>
              <p style="color:#bfdbfe;margin:10px 0 0 0;font-size:14px;">{{company_website}}</p>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding:40px 30px;">
              <h2 style="color:#1f2937;margin:0 0 20px 0;font-size:24px;">สวัสดีคุณ {{first_name}} {{last_name}}</h2>
              <p style="color:#4b5563;margin:0 0 20px 0;line-height:1.6;font-size:16px;">
                ขอบคุณที่ให้ความสนใจในบริการของเรา หากมีข้อสงสัยหรือต้องการข้อมูลเพิ่มเติม กรุณาติดต่อกลับมาได้เลย
              </p>
              <p style="color:#4b5563;margin:0;line-height:1.6;font-size:16px;">
                ด้วยความนับถือ<br>
                {{company_name}}
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color:#f3f4f6;padding:20px 30px;text-align:center;">
              <p style="color:#6b7280;margin:0;font-size:12px;">
                {{company_address}} | โทร: {{company_phone}} | อีเมล: {{company_email}}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
  },
  {
    id: 'template-2',
    name: 'Modern Minimal',
    nameTH: 'โมเดิร์นมินิมอล',
    thumbnail: '💙',
    html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{subject}}</title>
</head>
<body style="margin:0;padding:0;background-color:#ffffff;font-family:'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center">
        <table width="640" cellpadding="0" cellspacing="0">
          <!-- Logo Bar -->
          <tr>
            <td style="padding:40px 0 20px 0;text-align:center;border-bottom:3px solid #3b82f6;">
              <span style="font-size:24px;font-weight:bold;color:#1e3a8a;">{{company_name}}</span>
            </td>
          </tr>
          <!-- Main Content -->
          <tr>
            <td style="padding:40px 20px;">
              <p style="color:#374151;font-size:18px;margin:0;">สวัสดีคุณ <strong>{{full_name}}</strong></p>
              <div style="margin:30px 0;padding:20px;background-color:#f0f9ff;border-left:4px solid #3b82f6;">
                <p style="color:#1e3a8a;font-size:16px;margin:0;line-height:1.6;">
                  ขอบคุณสำหรับความไว้วางใจ ทีมงานของเราพร้อมให้บริการและตอบทุกคำถามของคุณ
                </p>
              </div>
              <p style="color:#6b7280;font-size:14px;margin:0;">
                ด้วยความนับถือ,<br>
                <strong>{{company_name}}</strong>
              </p>
            </td>
          </tr>
          <!-- Contact Bar -->
          <tr>
            <td style="background-color:#1e3a8a;padding:20px;text-align:center;">
              <p style="color:#ffffff;margin:0;font-size:12px;">
                {{company_phone}} | {{company_email}} | {{company_website}}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
  },
  {
    id: 'template-3',
    name: 'Warm Welcome',
    nameTH: 'ต้อนรับอบอุ่น',
    thumbnail: '🌸',
    html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{subject}}</title>
</head>
<body style="margin:0;padding:0;background:linear-gradient(135deg,#fef3c7 0%,#fde68a 100%);font-family:'Kanit',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table width="580" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:16px;box-shadow:0 10px 40px rgba(0,0,0,0.1);">
          <!-- Decorative Header -->
          <tr>
            <td style="padding:40px 30px 30px 30px;text-align:center;background:linear-gradient(135deg,#f59e0b 0%,#d97706 100%);border-radius:16px 16px 0 0;">
              <div style="font-size:48px;margin-bottom:10px;">💛</div>
              <h1 style="color:#ffffff;margin:0;font-size:26px;">{{company_name}}</h1>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding:40px 30px;">
              <h2 style="color:#92400e;margin:0 0 20px 0;font-size:22px;">👋 สวัสดีคุณ {{first_name}}!</h2>
              <p style="color:#451a03;margin:0 0 20px 0;line-height:1.8;font-size:16px;">
                ขอบคุณมากที่ติดต่อมาหาเรา ยินดีต้อนรับสู่ครอบครัว {{company_name}} เราหวังว่าจะได้รับใช้คุณด้วยความเต็มที่
              </p>
              <p style="color:#451a03;margin:0;line-height:1.8;font-size:16px;">
                หากมีคำถามใดๆ ติดต่อเราได้ตลอดเวลา ยินดีช่วยเหลือคุณเสมอ 😊
              </p>
              <div style="margin-top:30px;padding:20px;background-color:#fffbeb;border-radius:8px;text-align:center;">
                <p style="color:#b45309;margin:0;font-size:14px;">
                  📞 {{company_phone}} | ✉️ {{company_email}}
                </p>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
  },
  {
    id: 'template-4',
    name: 'Business Pro',
    nameTH: 'ธุรกิจโปร',
    thumbnail: '💼',
    html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{subject}}</title>
</head>
<body style="margin:0;padding:0;background-color:#0f172a;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f172a;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#1e293b;border-radius:12px;overflow:hidden;">
          <!-- Top Bar -->
          <tr>
            <td style="background-color:#334155;padding:15px 30px;">
              <span style="color:#94a3b8;font-size:12px;letter-spacing:2px;text-transform:uppercase;">CORPORATE</span>
            </td>
          </tr>
          <!-- Header -->
          <tr>
            <td style="padding:50px 30px;text-align:center;">
              <h1 style="color:#ffffff;margin:0;font-size:32px;font-weight:bold;">{{company_name}}</h1>
              <p style="color:#94a3b8;margin:15px 0 0 0;font-size:14px;">{{company_website}}</p>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding:0 30px 40px 30px;">
              <div style="background-color:#ffffff;border-radius:8px;padding:40px;">
                <h2 style="color:#1e293b;margin:0 0 20px 0;font-size:24px;">Dear {{full_name}}</h2>
                <p style="color:#475569;margin:0 0 20px 0;line-height:1.7;font-size:15px;">
                  Thank you for your interest in our services. We are pleased to provide you with comprehensive solutions tailored to your business needs.
                </p>
                <p style="color:#475569;margin:0;line-height:1.7;font-size:15px;">
                  Please feel free to reach out if you require any additional information.
                </p>
                <div style="margin-top:30px;padding-top:20px;border-top:1px solid #e2e8f0;">
                  <p style="color:#1e293b;margin:0;font-size:14px;">
                    <strong>Best regards,</strong><br>
                    {{company_name}}
                  </p>
                </div>
              </div>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color:#0f172a;padding:20px 30px;text-align:center;">
              <p style="color:#64748b;margin:0;font-size:11px;">
                {{company_address}} | {{company_phone}} | {{company_email}}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
  },
  {
    id: 'template-5',
    name: 'Elegant Purple',
    nameTH: 'หรูหราสีม่วง',
    thumbnail: '💜',
    html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{subject}}</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f3ff;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:20px;box-shadow:0 20px 60px rgba(124,58,237,0.15);">
          <!-- Header with pattern -->
          <tr>
            <td style="background:linear-gradient(135deg,#7c3aed 0%,#5b21b6 100%);padding:50px 30px;text-align:center;border-radius:20px 20px 0 0;">
              <div style="width:80px;height:80px;background-color:rgba(255,255,255,0.2);border-radius:50%;margin:0 auto 20px auto;display:flex;align-items:center;justify-content:center;">
                <span style="font-size:36px;">✨</span>
              </div>
              <h1 style="color:#ffffff;margin:0;font-size:28px;font-weight:300;">{{company_name}}</h1>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding:50px 40px;">
              <p style="color:#1f2937;font-size:18px;margin:0 0 25px 0;text-align:center;">
                Hello <span style="color:#7c3aed;font-weight:600;">{{first_name}}</span>
              </p>
              <p style="color:#4b5563;margin:0 0 20px 0;line-height:1.8;font-size:15px;text-align:center;">
                We are excited to have you here. Our team is ready to provide you with the best experience and solutions.
              </p>
              <div style="text-align:center;margin:30px 0;">
                <a href="{{company_website}}" style="display:inline-block;padding:14px 35px;background:linear-gradient(135deg,#7c3aed 0%,#5b21b6 100%);color:#ffffff;text-decoration:none;border-radius:30px;font-size:14px;font-weight:600;">Visit Our Website</a>
              </div>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color:#f5f3ff;padding:25px 40px;border-radius:0 0 20px 20px;text-align:center;">
              <p style="color:#6b7280;margin:0;font-size:12px;">
                {{company_address}} | {{company_phone}} | {{company_email}}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
  },
  {
    id: 'template-6',
    name: 'Fresh Green',
    nameTH: 'สดใสสีเขียว',
    thumbnail: '🌿',
    html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{subject}}</title>
</head>
<body style="margin:0;padding:0;background-color:#ecfdf5;font-family:sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:16px;overflow:hidden;">
          <!-- Green Header -->
          <tr>
            <td style="background-color:#059669;padding:40px 30px;text-align:center;">
              <div style="font-size:40px;margin-bottom:15px;">🌱</div>
              <h1 style="color:#ffffff;margin:0;font-size:26px;">{{company_name}}</h1>
              <p style="color:#a7f3d0;margin:10px 0 0 0;font-size:14px;">{{company_email}}</p>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding:40px 30px;">
              <h2 style="color:#065f46;margin:0 0 20px 0;font-size:22px;">Hi {{first_name}}!</h2>
              <p style="color:#047857;margin:0 0 15px 0;line-height:1.7;font-size:15px;">
                Thank you for connecting with us! We're here to help you grow your business with our innovative solutions.
              </p>
              <p style="color:#047857;margin:0 0 25px 0;line-height:1.7;font-size:15px;">
                Feel free to reach out anytime - we're just a call or email away!
              </p>
              <!-- Contact Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#ecfdf5;border-radius:12px;margin-top:20px;">
                <tr>
                  <td style="padding:20px;text-align:center;">
                    <p style="color:#065f46;margin:0;font-size:14px;font-weight:600;">📞 {{company_phone}}</p>
                    <p style="color:#065f46;margin:8px 0 0 0;font-size:14px;">🌐 {{company_website}}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
  },
  {
    id: 'template-7',
    name: 'Bold Orange',
    nameTH: 'กล้าหาญสีส้ม',
    thumbnail: '🔥',
    html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{subject}}</title>
</head>
<body style="margin:0;padding:0;background-color:#fff7ed;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table width="600" cellpadding="0" cellspacing="0">
          <!-- Large Icon -->
          <tr>
            <td style="padding-bottom:30px;text-align:center;">
              <span style="font-size:60px;">🚀</span>
            </td>
          </tr>
          <!-- Main Card -->
          <tr>
            <td style="background-color:#ffffff;border-radius:20px;padding:40px;box-shadow:0 10px 40px rgba(249,115,22,0.2);">
              <h1 style="color:#ea580c;margin:0 0 25px 0;font-size:28px;text-align:center;">{{company_name}}</h1>
              <h2 style="color:#1f2937;margin:0 0 20px 0;font-size:22px;">Hello {{full_name}}!</h2>
              <p style="color:#4b5563;margin:0 0 20px 0;line-height:1.7;font-size:15px;">
                We're thrilled to have you here! Let's explore how we can help you achieve your goals together.
              </p>
              <p style="color:#4b5563;margin:0;line-height:1.7;font-size:15px;">
                Get in touch with us today and let's start something amazing!
              </p>
              <!-- CTA Button -->
              <div style="text-align:center;margin:30px 0 0 0;">
                <a href="mailto:{{company_email}}" style="display:inline-block;padding:16px 40px;background-color:#ea580c;color:#ffffff;text-decoration:none;border-radius:50px;font-size:16px;font-weight:bold;">📩 Contact Us</a>
              </div>
            </td>
          </tr>
          <!-- Footer Info -->
          <tr>
            <td style="padding-top:30px;text-align:center;">
              <p style="color:#9a3412;font-size:13px;margin:0;">
                {{company_address}} • {{company_phone}}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
  },
  {
    id: 'template-8',
    name: 'Corporate Blue',
    nameTH: 'คอร์เปอเรตบลู',
    thumbnail: '🏛️',
    html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{subject}}</title>
</head>
<body style="margin:0;padding:0;background-color:#e0e7ff;font-family:'Times New Roman',serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table width="620" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border:1px solid #c7d2fe;">
          <!-- Top Line -->
          <tr>
            <td style="background-color:#3730a3;height:6px;"></td>
          </tr>
          <!-- Header -->
          <tr>
            <td style="padding:40px 30px 30px 30px;text-align:center;border-bottom:1px solid #e5e7eb;">
              <h1 style="color:#1e1b4b;margin:0;font-size:30px;font-family:Arial,sans-serif;font-weight:bold;">{{company_name}}</h1>
              <p style="color:#4f46e5;margin:10px 0 0 0;font-size:14px;font-family:Arial,sans-serif;">{{company_website}}</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px 30px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="width:3px;background-color:#3730a3;vertical-align:top;"></td>
                  <td style="padding-left:20px;">
                    <p style="color:#1f2937;font-size:17px;margin:0 0 15px 0;font-family:Arial,sans-serif;line-height:1.6;">
                      <strong>To:</strong> {{full_name}}<br>
                      <strong>Company:</strong> {{company_name}}
                    </p>
                    <p style="color:#4b5563;margin:20px 0;line-height:1.8;font-size:15px;font-family:Arial,sans-serif;">
                      We would like to extend our warmest greetings and express our appreciation for your interest in our products and services.
                    </p>
                    <p style="color:#4b5563;margin:0;line-height:1.8;font-size:15px;font-family:Arial,sans-serif;">
                      Please do not hesitate to contact us should you require any further information.
                    </p>
                    <p style="color:#1e1b4b;margin:30px 0 0 0;font-family:Arial,sans-serif;">
                      <strong>Sincerely,</strong><br>
                      {{company_name}}<br>
                      {{company_phone}}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Bottom Bar -->
          <tr>
            <td style="background-color:#e0e7ff;padding:20px 30px;text-align:center;border-top:1px solid #c7d2fe;">
              <p style="color:#4f46e5;margin:0;font-size:12px;font-family:Arial,sans-serif;">
                {{company_address}} | {{company_email}} | {{company_tax_id}}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
  },
  {
    id: 'template-9',
    name: 'Friendly Pink',
    nameTH: 'เป็นกันเองสีชมพู',
    thumbnail: '🎀',
    html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{subject}}</title>
</head>
<body style="margin:0;padding:0;background-color:#fdf2f8;font-family:sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table width="580" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:24px;overflow:hidden;">
          <!-- Pink Header -->
          <tr>
            <td style="background:linear-gradient(to right,#ec4899,#db2777);padding:50px 30px;text-align:center;">
              <div style="font-size:50px;margin-bottom:15px;">💖</div>
              <h1 style="color:#ffffff;margin:0;font-size:26px;">{{company_name}}</h1>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding:40px 30px;">
              <h2 style="color:#be185d;margin:0 0 20px 0;font-size:22px;text-align:center;">Hi {{first_name}}! 👋</h2>
              <p style="color:#831843;margin:0 0 20px 0;line-height:1.7;font-size:15px;text-align:center;">
                ขอบคุณมากๆ ที่ติดต่อมาหาเรานะคะ/ครับ 💕
              </p>
              <p style="color:#831843;margin:0 0 20px 0;line-height:1.7;font-size:15px;text-align:center;">
                ทีมงานของเราพร้อมดูแลคุณอย่างดีที่สุดแล้วค่ะ/ครับ
              </p>
              <!-- Cute Box -->
              <div style="background-color:#fdf2f8;padding:25px;border-radius:16px;margin-top:25px;text-align:center;">
                <p style="color:#db2777;margin:0;font-size:14px;">
                  ☕ Let's have a coffee chat!<br>
                  📞 {{company_phone }}<br>
                  💬 {{company_email}}
                </p>
              </div>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color:#fdf2f8;padding:20px;text-align:center;border-top:2px solid #fbcfe8;">
              <p style="color:#9d174d;margin:0;font-size:12px;">
                Made with 💖 by {{company_name}}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
  },
  {
    id: 'template-10',
    name: 'Newsletter Style',
    nameTH: 'สไตล์จดหมายข่าว',
    thumbnail: '📰',
    html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{subject}}</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:Georgia,serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table width="640" cellpadding="0" cellspacing="0" style="background-color:#ffffff;">
          <!-- Newsletter Header -->
          <tr>
            <td style="background-color:#0f172a;padding:30px;text-align:center;">
              <p style="color:#94a3b8;margin:0 0 10px 0;font-size:12px;letter-spacing:3px;text-transform:uppercase;">Newsletter</p>
              <h1 style="color:#ffffff;margin:0;font-size:28px;font-family:Arial,sans-serif;">{{company_name}}</h1>
            </td>
          </tr>
          <!-- Date Bar -->
          <tr>
            <td style="background-color:#e2e8f0;padding:12px 30px;">
              <p style="color:#64748b;margin:0;font-size:12px;font-family:Arial,sans-serif;text-align:right;">{{current_date}}</p>
            </td>
          </tr>
          <!-- Main Content -->
          <tr>
            <td style="padding:40px 30px;">
              <h2 style="color:#1e293b;margin:0 0 20px 0;font-size:24px;font-family:Arial,sans-serif;">Hello, {{first_name}}!</h2>
              <p style="color:#475569;margin:0 0 20px 0;line-height:1.8;font-size:15px;">
                Welcome to our newsletter! Here's what's new with us and how we can help you.
              </p>
              <!-- Article Box -->
              <div style="background-color:#f8fafc;padding:25px;border-left:4px solid #3b82f6;margin:30px 0;">
                <h3 style="color:#1e293b;margin:0 0 15px 0;font-size:18px;font-family:Arial,sans-serif;">📢 Latest Updates</h3>
                <p style="color:#64748b;margin:0;line-height:1.7;font-size:14px;">
                  Stay tuned for the latest news, promotions, and updates from our team. We're always working on something new for you!
                </p>
              </div>
              <p style="color:#475569;margin:0;line-height:1.8;font-size:15px;">
                Don't hesitate to reach out if you have any questions. We're here to help!
              </p>
            </td>
          </tr>
          <!-- Social / Contact -->
          <tr>
            <td style="background-color:#f1f5f9;padding:25px 30px;text-align:center;">
              <p style="color:#475569;margin:0 0 10px 0;font-size:14px;font-family:Arial,sans-serif;">
                <strong>Contact Us:</strong> {{company_phone}} | {{company_email}}
              </p>
              <p style="color:#94a3b8;margin:0;font-size:12px;font-family:Arial,sans-serif;">
                {{company_address}}
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color:#0f172a;padding:20px;text-align:center;">
              <p style="color:#64748b;margin:0;font-size:11px;font-family:Arial,sans-serif;">
                © {{current_year}} {{company_name}}. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
  },
  {
    id: 'template-11',
    name: 'Tech Startup',
    nameTH: 'เทคสตาร์ทอัพ',
    thumbnail: '💻',
    html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{subject}}</title>
</head>
<body style="margin:0;padding:0;background-color:#030712;font-family:'SF Pro Display','Inter',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding:60px 20px;">
        <table width="600" cellpadding="0" cellspacing="0">
          <!-- Animated Header -->
          <tr>
            <td style="text-align:center;padding-bottom:40px;">
              <div style="display:inline-block;padding:12px 24px;background:linear-gradient(90deg,#06b6d4,#8b5cf6);border-radius:50px;margin-bottom:30px;">
                <span style="color:#ffffff;font-size:14px;font-weight:600;letter-spacing:1px;">🚀 INNOVATION</span>
              </div>
              <h1 style="color:#ffffff;margin:0;font-size:36px;font-weight:700;">{{company_name}}</h1>
              <p style="color:#9ca3af;margin:15px 0 0 0;font-size:16px;">{{company_website}}</p>
            </td>
          </tr>
          <!-- Main Card -->
          <tr>
            <td style="background-color:#111827;border-radius:16px;padding:50px 40px;border:1px solid #1f2937;">
              <h2 style="color:#ffffff;margin:0 0 25px 0;font-size:28px;font-weight:600;">Hello {{first_name}}! 👋</h2>
              <p style="color:#d1d5db;margin:0 0 20px 0;line-height:1.7;font-size:16px;">
                Welcome to the future of technology! We're excited to have you join our community of innovators.
              </p>
              <!-- Feature Box -->
              <div style="background:linear-gradient(135deg,#1e1b4b 0%,#312e81 100%);border-radius:12px;padding:30px;margin:30px 0;">
                <p style="color:#a5b4fc;margin:0;font-size:15px;line-height:1.6;">
                  ✨ <strong>What's New:</strong> Discover cutting-edge solutions designed to transform your business.
                </p>
              </div>
              <p style="color:#9ca3af;margin:0;line-height:1.7;font-size:15px;">
                Let's build something amazing together!
              </p>
              <!-- CTA -->
              <div style="text-align:center;margin:35px 0 0 0;">
                <a href="{{company_website}}" style="display:inline-block;padding:16px 40px;background:linear-gradient(90deg,#06b6d4,#8b5cf6);color:#ffffff;text-decoration:none;border-radius:8px;font-size:15px;font-weight:600;">Explore Now →</a>
              </div>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:30px;text-align:center;">
              <p style="color:#6b7280;margin:0;font-size:13px;">
                {{company_phone}} • {{company_email}}
              </p>
              <p style="color:#374151;margin:15px 0 0 0;font-size:12px;">
                © {{current_year}} {{company_name}}. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
  },
  {
    id: 'template-12',
    name: 'Luxury Premium',
    nameTH: 'หรูหรูระดับพรีเมียม',
    thumbnail: '💎',
    html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{subject}}</title>
</head>
<body style="margin:0;padding:0;background-color:#000000;font-family:'Playfair Display',Georgia,serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding:60px 20px;">
        <table width="580" cellpadding="0" cellspacing="0">
          <!-- Luxury Header -->
          <tr>
            <td style="text-align:center;padding-bottom:40px;border-bottom:1px solid #1f2937;">
              <div style="width:60px;height:60px;border:1px solid #d4af37;border-radius:50%;margin:0 auto 25px auto;display:flex;align-items:center;justify-content:center;">
                <span style="font-size:28px;">💎</span>
              </div>
              <h1 style="color:#d4af37;margin:0;font-size:32px;font-weight:400;letter-spacing:8px;text-transform:uppercase;">{{company_name}}</h1>
              <p style="color:#9ca3af;margin:20px 0 0 0;font-size:11px;letter-spacing:4px;text-transform:uppercase;">Premium Experience</p>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding:50px 30px;">
              <p style="color:#d1d5db;margin:0 0 30px 0;font-size:18px;text-align:center;font-style:italic;">
                "Excellence is not a destination but a continuous journey."
              </p>
              <h2 style="color:#ffffff;margin:0 0 25px 0;font-size:24px;text-align:center;font-family:Arial,sans-serif;">Dear {{full_name}}</h2>
              <p style="color:#9ca3af;margin:0;line-height:1.8;font-size:14px;text-align:center;font-family:Arial,sans-serif;">
                Thank you for being part of our exclusive community. We are honored to serve you with the finest quality and unparalleled service.
              </p>
              <!-- VIP Box -->
              <div style="border:1px solid #d4af37;border-radius:8px;padding:30px;margin:40px 0;text-align:center;">
                <p style="color:#d4af37;margin:0;font-size:13px;letter-spacing:2px;text-transform:uppercase;font-family:Arial,sans-serif;">
                  ✨ Exclusive Access
                </p>
                <p style="color:#d1d5db;margin:15px 0 0 0;font-size:14px;font-family:Arial,sans-serif;">
                  Members enjoy priority service and special privileges
                </p>
              </div>
            </td>
          </tr>
          <!-- Contact -->
          <tr>
            <td style="background-color:#0a0a0a;padding:30px;text-align:center;border-top:1px solid #1f2937;">
              <p style="color:#6b7280;margin:0;font-size:12px;font-family:Arial,sans-serif;">
                {{company_phone}} | {{company_email}}
              </p>
              <p style="color:#374151;margin:15px 0 0 0;font-size:11px;font-family:Arial,sans-serif;">
                {{company_address}}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
  },
  {
    id: 'template-13',
    name: 'Seasonal Holiday',
    nameTH: 'ฤดูกาลวันหยุด',
    thumbnail: '🎄',
    html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{subject}}</title>
</head>
<body style="margin:0;padding:0;background:linear-gradient(135deg,#1a2a6c 0%,#b21f1f 0%,#fdbb2d 100%);font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.3);">
          <!-- Holiday Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#c41e3a 0%,#1a2a6c 100%);padding:50px 30px;text-align:center;">
              <div style="font-size:60px;margin-bottom:15px;">🎄</div>
              <h1 style="color:#ffffff;margin:0;font-size:28px;font-weight:bold;">Season's Greetings</h1>
              <p style="color:#fcd34d;margin:15px 0 0 0;font-size:16px;">{{company_name}}</p>
            </td>
          </tr>
          <!-- Snow Effect -->
          <tr>
            <td style="background-color:#f0fdf4;padding:40px 30px;text-align:center;">
              <p style="color:#166534;margin:0;font-size:24px;font-weight:600;">Dear {{full_name}} 🌟</p>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding:40px 30px;">
              <p style="color:#374151;margin:0 0 20px 0;line-height:1.8;font-size:15px;text-align:center;">
                As the year comes to a close, we want to express our heartfelt gratitude for your continued support and trust.
              </p>
              <p style="color:#374151;margin:0;line-height:1.8;font-size:15px;text-align:center;">
                Wishing you and your family a joyful holiday season and a prosperous {{current_year}}!
              </p>
              <!-- Gift Box -->
              <div style="background:linear-gradient(135deg,#fef3c7 0%,#fde68a 100%);border-radius:12px;padding:25px;margin:30px 0;text-align:center;">
                <p style="color:#92400e;margin:0;font-size:15px;font-weight:600;">🎁 Special Offer for You!</p>
                <p style="color:#b45309;margin:10px 0 0 0;font-size:13px;">Contact us to learn more</p>
              </div>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color:#1a2a6c;padding:25px 30px;text-align:center;">
              <p style="color:#ffffff;margin:0;font-size:13px;">
                📞 {{company_phone}} | ✉️ {{company_email}}
              </p>
              <p style="color:#94a3b8;margin:15px 0 0 0;font-size:11px;">
                © {{current_year}} {{company_name}}. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
  },
  {
    id: 'template-14',
    name: 'Special Announcement',
    nameTH: 'ประกาศพิเศษ',
    thumbnail: '📢',
    html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{subject}}</title>
</head>
<body style="margin:0;padding:0;background-color:#fef2f2;font-family:sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 10px 40px rgba(220,38,38,0.1);">
          <!-- Announcement Header -->
          <tr>
            <td style="background-color:#dc2626;padding:40px 30px;text-align:center;">
              <div style="display:inline-block;padding:8px 20px;background-color:#ffffff;border-radius:50px;margin-bottom:15px;">
                <span style="color:#dc2626;font-size:12px;font-weight:bold;letter-spacing:1px;">📢 ANNOUNCEMENT</span>
              </div>
              <h1 style="color:#ffffff;margin:0;font-size:26px;font-weight:bold;">{{company_name}}</h1>
            </td>
          </tr>
          <!-- Important Badge -->
          <tr>
            <td style="padding:30px 30px 0 30px;text-align:center;">
              <div style="display:inline-block;padding:10px 25px;background-color:#fef2f2;border:2px solid #dc2626;border-radius:8px;">
                <p style="color:#dc2626;margin:0;font-size:14px;font-weight:600;">⚡ Important Update</p>
              </div>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding:30px;">
              <h2 style="color:#1f2937;margin:0 0 20px 0;font-size:22px;text-align:center;">Hello {{first_name}}!</h2>
              <p style="color:#4b5563;margin:0 0 20px 0;line-height:1.7;font-size:15px;text-align:center;">
                We have an exciting update to share with you! Our team has been working hard to bring you new improvements and features.
              </p>
              <!-- Notice Box -->
              <div style="background-color:#fef2f2;border-left:4px solid #dc2626;padding:20px;margin:25px 0;border-radius:0 8px 8px 0;">
                <p style="color:#991b1b;margin:0;font-size:14px;line-height:1.6;">
                  <strong>📌 What's New:</strong><br>
                  • Enhanced features and capabilities<br>
                  • Improved user experience<br>
                  • Better performance and reliability
                </p>
              </div>
              <p style="color:#4b5563;margin:0;line-height:1.7;font-size:15px;text-align:center;">
                Stay tuned for more updates!
              </p>
            </td>
          </tr>
          <!-- CTA -->
          <tr>
            <td style="padding:0 30px 30px 30px;text-align:center;">
              <a href="{{company_website}}" style="display:inline-block;padding:14px 35px;background-color:#dc2626;color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">Learn More</a>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color:#fef2f2;padding:20px 30px;text-align:center;border-top:1px solid #fecaca;">
              <p style="color:#991b1b;margin:0;font-size:12px;">
                {{company_phone}} | {{company_email}}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
  },
  {
    id: 'template-15',
    name: 'Thank You Appreciation',
    nameTH: 'ขอบคุณอย่างสูง',
    thumbnail: '🙏',
    html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{subject}}</title>
</head>
<body style="margin:0;padding:0;background-color:#fffbeb;font-family:'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding:50px 20px;">
        <table width="580" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 15px 50px rgba(245,158,11,0.15);">
          <!-- Thank You Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#f59e0b 0%,#d97706 100%);padding:50px 30px;text-align:center;">
              <div style="font-size:70px;margin-bottom:20px;">🙏</div>
              <h1 style="color:#ffffff;margin:0;font-size:30px;font-weight:bold;">ขอบคุณอย่างสูง</h1>
              <p style="color:#fef3c7;margin:15px 0 0 0;font-size:16px;">Thank You So Much!</p>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding:50px 35px;">
              <h2 style="color:#92400e;margin:0 0 25px 0;font-size:24px;text-align:center;">Dear {{full_name}}</h2>
              <p style="color:#451a03;margin:0 0 20px 0;line-height:1.8;font-size:16px;text-align:center;">
                ขอบคุณมากที่ให้โอกาสเราได้รับใช้คุณ
              </p>
              <p style="color:#451a03;margin:0 0 25px 0;line-height:1.8;font-size:16px;text-align:center;">
                We deeply appreciate your trust in us. Your satisfaction is our highest priority.
              </p>
              <!-- Appreciation Box -->
              <div style="background-color:#fffbeb;border:2px solid #fcd34d;border-radius:12px;padding:25px;margin:30px 0;text-align:center;">
                <p style="color:#b45309;margin:0;font-size:15px;font-weight:600;">🌟 Our Promise</p>
                <p style="color:#92400e;margin:10px 0 0 0;font-size:14px;line-height:1.6;">
                  We will continue to provide the best service possible
                </p>
              </div>
              <p style="color:#451a03;margin:0;line-height:1.8;font-size:15px;text-align:center;">
                หากมีข้อสงสัยใดๆ กรุณาติดต่อเราได้ตลอดเวลา<br>
                Feel free to reach out anytime!
              </p>
            </td>
          </tr>
          <!-- Contact -->
          <tr>
            <td style="background-color:#fffbeb;padding:25px 30px;text-align:center;border-top:1px solid #fde68a;">
              <p style="color:#b45309;margin:0;font-size:14px;font-weight:600;">
                📞 {{company_phone}} | ✉️ {{company_email}}
              </p>
              <p style="color:#92400e;margin:15px 0 0 0;font-size:12px;">
                {{company_address}}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
  },
  {
    id: 'template-16',
    name: 'Product Launch',
    nameTH: 'เปิดตัวสินค้า',
    thumbnail: '🚀',
    html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{subject}}</title>
</head>
<body style="margin:0;padding:0;background-color:#000000;font-family:Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table width="600" cellpadding="0" cellspacing="0">
          <!-- Launch Header -->
          <tr>
            <td style="text-align:center;padding-bottom:30px;">
              <div style="display:inline-block;padding:10px 25px;background:linear-gradient(90deg,#f97316,#ef4444);border-radius:50px;margin-bottom:20px;">
                <span style="color:#ffffff;font-size:13px;font-weight:bold;letter-spacing:2px;">🚀 NEW LAUNCH</span>
              </div>
              <h1 style="color:#ffffff;margin:0;font-size:42px;font-weight:800;">{{company_name}}</h1>
            </td>
          </tr>
          <!-- Main Card -->
          <tr>
            <td style="background-color:#111827;border-radius:20px;padding:50px 40px;">
              <div style="text-align:center;margin-bottom:30px;">
                <span style="font-size:80px;">🎉</span>
              </div>
              <h2 style="color:#ffffff;margin:0 0 20px 0;font-size:32px;text-align:center;font-weight:bold;">Introducing Our Latest Innovation!</h2>
              <p style="color:#d1d5db;margin:0 0 25px 0;line-height:1.7;font-size:16px;text-align:center;">
                We're thrilled to announce the launch of something extraordinary. {{first_name}}, we thought of you first!
              </p>
              <!-- Features -->
              <div style="background-color:#1f2937;border-radius:12px;padding:25px;margin:30px 0;">
                <p style="color:#f97316;margin:0 0 15px 0;font-size:14px;font-weight:bold;text-transform:uppercase;">✨ Key Features</p>
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding:8px 0;color:#e5e7eb;font-size:14px;">✓ Revolutionary new capabilities</td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0;color:#e5e7eb;font-size:14px;">✓ Enhanced performance</td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0;color:#e5e7eb;font-size:14px;">✓ Exclusive early access for you</td>
                  </tr>
                </table>
              </div>
              <!-- CTA -->
              <div style="text-align:center;margin:30px 0 0 0;">
                <a href="{{company_website}}" style="display:inline-block;padding:18px 50px;background:linear-gradient(90deg,#f97316,#ef4444);color:#ffffff;text-decoration:none;border-radius:50px;font-size:16px;font-weight:bold;">Explore Now →</a>
              </div>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:30px;text-align:center;">
              <p style="color:#6b7280;margin:0;font-size:13px;">
                {{company_phone}} • {{company_email}} • {{company_website}}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
  },
  {
    id: 'template-17',
    name: 'Event Invitation',
    nameTH: 'เชิญงาน',
    thumbnail: '📅',
    html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{subject}}</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:16px;overflow:hidden;">
          <!-- Event Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#4f46e5 0%,#7c3aed 100%);padding:40px 30px;text-align:center;">
              <p style="color:#c7d2fe;margin:0 0 10px 0;font-size:12px;letter-spacing:3px;text-transform:uppercase;">You're Invited</p>
              <h1 style="color:#ffffff;margin:0;font-size:28px;font-weight:bold;">📅 Event Invitation</h1>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding:40px 30px;">
              <h2 style="color:#1f2937;margin:0 0 20px 0;font-size:22px;text-align:center;">Dear {{full_name}}</h2>
              <p style="color:#4b5563;margin:0 0 20px 0;line-height:1.7;font-size:15px;text-align:center;">
                We would be honored to have you join us at our upcoming event!
              </p>
              <!-- Event Details -->
              <div style="background-color:#eef2ff;border-radius:12px;padding:25px;margin:25px 0;text-align:center;">
                <p style="color:#4f46e5;margin:0;font-size:16px;font-weight:bold;">🗓️ Event Details</p>
                <div style="margin-top:15px;">
                  <p style="color:#374151;margin:8px 0;font-size:14px;"><strong>Date:</strong> {{current_date}}</p>
                  <p style="color:#374151;margin:8px 0;font-size:14px;"><strong>Time:</strong> 10:00 AM - 4:00 PM</p>
                  <p style="color:#374151;margin:8px 0;font-size:14px;"><strong>Location:</strong> {{company_address}}</p>
                </div>
              </div>
              <p style="color:#4b5563;margin:0;line-height:1.7;font-size:15px;text-align:center;">
                Please RSVP at your earliest convenience.
              </p>
              <!-- RSVP Button -->
              <div style="text-align:center;margin:30px 0 0 0;">
                <a href="mailto:{{company_email}}" style="display:inline-block;padding:14px 35px;background-color:#4f46e5;color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">RSVP Now</a>
              </div>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color:#f3f4f6;padding:20px 30px;text-align:center;">
              <p style="color:#6b7280;margin:0;font-size:12px;">
                Questions? Contact us at {{company_email}}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
  },
  {
    id: 'template-18',
    name: 'Survey Feedback',
    nameTH: 'แบบสำรวจความคิดเห็น',
    thumbnail: '📝',
    html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{subject}}</title>
</head>
<body style="margin:0;padding:0;background-color:#f0fdf4;font-family:sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 10px 40px rgba(34,197,94,0.1);">
          <!-- Survey Header -->
          <tr>
            <td style="background-color:#16a34a;padding:40px 30px;text-align:center;">
              <div style="font-size:60px;margin-bottom:15px;">📝</div>
              <h1 style="color:#ffffff;margin:0;font-size:26px;font-weight:bold;">We Value Your Opinion</h1>
              <p style="color:#bbf7d0;margin:15px 0 0 0;font-size:14px;">Your feedback matters to us</p>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding:40px 30px;">
              <h2 style="color:#166534;margin:0 0 20px 0;font-size:22px;text-align:center;">Hi {{first_name}}!</h2>
              <p style="color:#14532d;margin:0 0 20px 0;line-height:1.7;font-size:15px;text-align:center;">
                Help us improve! Please take a moment to share your thoughts about your experience with us.
              </p>
              <!-- Survey Box -->
              <div style="background-color:#f0fdf4;border:2px solid #16a34a;border-radius:12px;padding:25px;margin:25px 0;text-align:center;">
                <p style="color:#166534;margin:0;font-size:15px;font-weight:600;">🎯 Quick 2-Minute Survey</p>
                <p style="color:#15803d;margin:10px 0 0 0;font-size:13px;">
                  Your honest feedback helps us serve you better
                </p>
              </div>
              <p style="color:#14532d;margin:0;line-height:1.7;font-size:14px;text-align:center;">
                It only takes 2 minutes and means the world to us!
              </p>
              <!-- Survey Button -->
              <div style="text-align:center;margin:30px 0 0 0;">
                <a href="{{company_website}}" style="display:inline-block;padding:14px 35px;background-color:#16a34a;color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">Take Survey →</a>
              </div>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color:#f0fdf4;padding:20px 30px;text-align:center;border-top:1px solid #bbf7d0;">
              <p style="color:#15803d;margin:0;font-size:12px;">
                Thank you for your time! 🙏
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
  },
  {
    id: 'template-19',
    name: 'Membership Welcome',
    nameTH: 'ต้อนรับสมาชิกใหม่',
    thumbnail: '🎫',
    html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{subject}}</title>
</head>
<body style="margin:0;padding:0;background-color:#fefce8;font-family:'Kanit', Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 15px 50px rgba(234,179,8,0.15);">
          <!-- Member Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#eab308 0%,#ca8a04 100%);padding:50px 30px;text-align:center;">
              <div style="font-size:70px;margin-bottom:20px;">🎫</div>
              <h1 style="color:#ffffff;margin:0;font-size:32px;font-weight:bold;">ยินดีต้อนรับสู่ครอบครัว</h1>
              <p style="color:#fef08a;margin:15px 0 0 0;font-size:16px;">Welcome to the Family!</p>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding:45px 35px;">
              <h2 style="color:#713f12;margin:0 0 20px 0;font-size:24px;text-align:center;">สวัสดีคุณ {{first_name}} {{last_name}} 🎉</h2>
              <p style="color:#451a03;margin:0 0 20px 0;line-height:1.8;font-size:16px;text-align:center;">
                ยินดีต้อนรับสู่ครอบครัว {{company_name}}!
              </p>
              <p style="color:#451a03;margin:0 0 25px 0;line-height:1.8;font-size:15px;text-align:center;">
                ตอนนี้คุณเป็นสมาชิกของเราแล้ว พร้อมรับสิทธิประโยชน์มากมายที่รอคุณอยู่
              </p>
              <!-- Benefits Box -->
              <div style="background:linear-gradient(135deg,#fef9c3 0%,#fef08a 100%);border-radius:12px;padding:25px;margin:30px 0;">
                <p style="color:#a16207;margin:0 0 15px 0;font-size:15px;font-weight:bold;text-align:center;">✨ สิทธิประโยชน์สำหรับสมาชิก</p>
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding:6px 0;color:#713f12;font-size:14px;">✓ ส่วนลดพิเศษสำหรับสมาชิก</td>
                  </tr>
                  <tr>
                    <td style="padding:6px 0;color:#713f12;font-size:14px;">✓ ข่าวสารและโปรโมชั่นล่าสุด</td>
                  </tr>
                  <tr>
                    <td style="padding:6px 0;color:#713f12;font-size:14px;">✓ บริการลูกค้าสุดพิเศษ</td>
                  </tr>
                </table>
              </div>
              <p style="color:#451a03;margin:0;line-height:1.8;font-size:14px;text-align:center;">
                หากมีคำถามใดๆ ติดต่อเราได้ตลอดเวลานะคะ/ครับ
              </p>
            </td>
          </tr>
          <!-- Contact -->
          <tr>
            <td style="background-color:#fefce8;padding:25px 30px;text-align:center;border-top:1px solid #fef08a;">
              <p style="color:#a16207;margin:0;font-size:14px;font-weight:600;">
                📞 {{company_phone}} | ✉️ {{company_email}}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
  },
  {
    id: 'template-20',
    name: 'Flash Sale',
    nameTH: 'ลดราคาด่วน',
    thumbnail: '⚡',
    html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{subject}}</title>
</head>
<body style="margin:0;padding:0;background-color:#000000;font-family:Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding:30px 20px;">
        <table width="600" cellpadding="0" cellspacing="0">
          <!-- Sale Header -->
          <tr>
            <td style="text-align:center;padding-bottom:20px;">
              <div style="display:inline-block;padding:12px 30px;background-color:#ff0000;border-radius:50px;margin-bottom:15px;animation:pulse 2s infinite;">
                <span style="color:#ffffff;font-size:18px;font-weight:800;letter-spacing:2px;">⚡ FLASH SALE ⚡</span>
              </div>
              <h1 style="color:#ffffff;margin:0;font-size:48px;font-weight:900;">{{company_name}}</h1>
            </td>
          </tr>
          <!-- Main Card -->
          <tr>
            <td style="background-color:#111827;border-radius:16px;padding:45px 35px;border:2px solid #ff0000;">
              <div style="text-align:center;margin-bottom:25px;">
                <span style="font-size:80px;">🔥</span>
              </div>
              <h2 style="color:#ff0000;margin:0 0 15px 0;font-size:36px;text-align:center;font-weight:bold;">50% OFF!</h2>
              <p style="color:#ffffff;margin:0 0 10px 0;font-size:20px;text-align:center;">
                Hi {{first_name}}!
              </p>
              <p style="color:#d1d5db;margin:0 0 25px 0;line-height:1.6;font-size:15px;text-align:center;">
                Don't miss out on our biggest sale of the year! Limited time only.
              </p>
              <!-- Timer Box -->
              <div style="background-color:#1f2937;border-radius:12px;padding:20px;margin:25px 0;text-align:center;">
                <p style="color:#ef4444;margin:0;font-size:14px;font-weight:bold;letter-spacing:1px;">⏰ ends in:</p>
                <p style="color:#ffffff;margin:10px 0 0 0;font-size:28px;font-weight:bold;">24:00:00</p>
              </div>
              <!-- CTA -->
              <div style="text-align:center;margin:25px 0 0 0;">
                <a href="{{company_website}}" style="display:inline-block;padding:18px 45px;background-color:#ff0000;color:#ffffff;text-decoration:none;border-radius:50px;font-size:16px;font-weight:bold;">Shop Now →</a>
              </div>
              <p style="color:#6b7280;margin:20px 0 0 0;font-size:11px;text-align:center;">
                *Terms and conditions apply. While supplies last.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:25px;text-align:center;">
              <p style="color:#6b7280;margin:0;font-size:12px;">
                {{company_phone}} | {{company_email}} | {{company_website}}
              </p>
              <p style="color:#374151;margin:15px 0 0 0;font-size:11px;">
                © {{current_year}} {{company_name}}. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
  }
];

// Additional merge tags
export const additionalMergeTags = [
  { tag: '{{current_date}}', description: 'Current date (DD/MM/YYYY)' },
  { tag: '{{current_year}}', description: 'Current year' }
];

export default emailTemplates;
