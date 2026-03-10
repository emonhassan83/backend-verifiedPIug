import emailSender from './emailSender'
import { TUser } from '../modules/user/user.interface'
import { TWithdraw } from '../modules/withdraw/withdraw.interface'
import { TWithdrawStatus } from '../modules/withdraw/withdraw.constant'
import { TOrder } from '../modules/order/order.interface'

// Reusable base email template
const baseEmailTemplate = (
  title: string,
  greetingName: string,
  content: string,
  ctaText?: string,
  ctaLink?: string,
) => `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
    <h2 style="color: #333;">${title}</h2>
    <p style="color: #555;">Dear ${greetingName},</p>
    ${content}
    ${
      ctaText && ctaLink
        ? `
      <p style="text-align: center; margin: 30px 0;">
        <a href="${ctaLink}" style="padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">
          ${ctaText}
        </a>
      </p>
    `
        : ''
    }
    <p style="color: #555;">Best regards,<br/><strong>Verified Plug Team</strong></p>
    <div style="text-align: center; margin-top: 20px; font-size: 12px; color: #999;">
      <p>© ${new Date().getFullYear()} Verified Plug App. All rights reserved.</p>
    </div>
  </div>
`

// 6. When withdraw is completed → email to user
export const sendWithdrawCompletedEmail = async (
  user: TUser,
  withdraw: TWithdraw,
  order: TOrder,
) => {
  if (!user?.email) return

  const content = `
    <p style="color: #555;">Great news! Your withdrawal request has been successfully processed.</p>
    <ul style="color: #555; line-height: 1.6;">
      <li><strong>Amount:</strong> $${withdraw.amount.toFixed(2)}</li>
      ${
        order
          ? `
        <li><strong>From Order:</strong> ${order.title})</li>
      `
          : ''
      }
      <li><strong>Status:</strong> Completed</li>
    </ul>
    <p style="color: #555;">The funds should now be available in your connected account.</p>
    <p style="color: #555;">Please open the Verified Plug app and check your Earnings section for full details.</p>
    <p style="color: #555;">Thank you for being part of Verified Plug!</p>
  `

  await emailSender(
    user.email,
    'Withdrawal Completed – Funds Transferred',
    baseEmailTemplate('Withdrawal Completed', user.name, content),
  )
}

// 7. When withdraw status changes → email to user
export const sendWithdrawStatusChangeEmail = async (
  user: TUser,
  withdraw: TWithdraw,
  newStatus: TWithdrawStatus,
) => {
  if (!user?.email) return

  const statusText =
    newStatus === 'completed'
      ? 'Completed'
      : newStatus === 'proceed'
        ? 'Proceed'
        : newStatus === 'hold'
          ? 'Hold'
          : newStatus

  const content = `
    <p style="color: #555;">Your withdrawal request status has been updated:</p>
    <ul style="color: #555; line-height: 1.6;">
      <li><strong>Amount:</strong> $${withdraw.amount.toFixed(2)}</li>
      <li><strong>Current Status:</strong> ${statusText}</li>
    </ul>
    <p style="color: #555;">Please open the Verified Plug app and check your Withdrawals section for more details.</p>
  `

  await emailSender(
    user.email,
    `Withdrawal Status Updated – ${statusText}`,
    baseEmailTemplate(`Withdrawal ${statusText}`, user.name, content),
  )
}
