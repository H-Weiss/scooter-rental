// src/services/notificationService.js
import emailjs from '@emailjs/browser'

// הגדרות EmailJS - יש לעדכן בהתאם לפרטים שלך
const EMAILJS_CONFIG = {
  SERVICE_ID: 'your_service_id', // מ-EmailJS
  TEMPLATE_ID: 'template_new_rental', // Template שתיצור ב-EmailJS
  PUBLIC_KEY: 'your_public_key' // מ-EmailJS
}

// אתחול EmailJS
emailjs.init(EMAILJS_CONFIG.PUBLIC_KEY)

/**
 * שליחת הודעה על הזמנה חדשה
 */
export const sendNewRentalNotification = async (rentalData) => {
  try {
    // הכנת הנתונים לשליחה
    const templateParams = {
      // פרטי ההזמנה
      order_number: rentalData.orderNumber,
      customer_name: rentalData.customerName,
      passport_number: rentalData.passportNumber,
      
      // פרטי הקטנוע
      scooter_license: rentalData.scooterLicense,
      scooter_color: rentalData.scooterColor,
      
      // תאריכים ושעות
      start_date: new Date(rentalData.startDate).toLocaleDateString('en-GB'),
      end_date: new Date(rentalData.endDate).toLocaleDateString('en-GB'),
      start_time: rentalData.startTime || '09:00',
      end_time: rentalData.endTime || '18:00',
      
      // פרטי התשלום
      daily_rate: rentalData.dailyRate,
      deposit: rentalData.deposit || 4000,
      total_days: Math.ceil((new Date(rentalData.endDate) - new Date(rentalData.startDate)) / (1000 * 60 * 60 * 24)),
      total_amount: rentalData.dailyRate * Math.ceil((new Date(rentalData.endDate) - new Date(rentalData.startDate)) / (1000 * 60 * 60 * 24)),
      
      // פרטי קשר
      whatsapp_full: `${rentalData.whatsappCountryCode} ${rentalData.whatsappNumber}`,
      whatsapp_link: `https://wa.me/${rentalData.whatsappCountryCode.replace('+', '')}${rentalData.whatsappNumber}`,
      
      // הערות
      notes: rentalData.notes || 'No additional notes',
      
      // זמן יצירה
      created_at: new Date().toLocaleString('en-GB', {
        timeZone: 'Asia/Bangkok' // זמן תאילנד
      })
    }

    console.log('Sending notification with params:', templateParams)

    const response = await emailjs.send(
      EMAILJS_CONFIG.SERVICE_ID,
      EMAILJS_CONFIG.TEMPLATE_ID,
      templateParams
    )

    console.log('Notification sent successfully:', response)
    return { success: true, response }

  } catch (error) {
    console.error('Failed to send notification:', error)
    return { success: false, error: error.message }
  }
}

/**
 * שליחת הודעה על עדכון הזמנה
 */
export const sendRentalUpdateNotification = async (originalRental, updatedRental) => {
  try {
    // חישוב השינויים
    const changes = []
    
    if (originalRental.endDate !== updatedRental.endDate) {
      changes.push(`End date changed from ${new Date(originalRental.endDate).toLocaleDateString('en-GB')} to ${new Date(updatedRental.endDate).toLocaleDateString('en-GB')}`)
    }
    
    if (originalRental.dailyRate !== updatedRental.dailyRate) {
      changes.push(`Daily rate changed from ฿${originalRental.dailyRate} to ฿${updatedRental.dailyRate}`)
    }
    
    if (originalRental.whatsappNumber !== updatedRental.whatsappNumber) {
      changes.push(`WhatsApp changed from ${originalRental.whatsappCountryCode} ${originalRental.whatsappNumber} to ${updatedRental.whatsappCountryCode} ${updatedRental.whatsappNumber}`)
    }
    
    const templateParams = {
      order_number: updatedRental.orderNumber,
      customer_name: updatedRental.customerName,
      scooter_license: updatedRental.scooterLicense,
      changes_list: changes.join('\n'),
      updated_at: new Date().toLocaleString('en-GB', {
        timeZone: 'Asia/Bangkok'
      })
    }

    const response = await emailjs.send(
      EMAILJS_CONFIG.SERVICE_ID,
      'template_rental_update', // Template נפרד לעדכונים
      templateParams
    )

    console.log('Update notification sent successfully:', response)
    return { success: true, response }

  } catch (error) {
    console.error('Failed to send update notification:', error)
    return { success: false, error: error.message }
  }
}

/**
 * בדיקת חיבור לשירות
 */
export const testNotificationService = async () => {
  try {
    const testParams = {
      test_message: 'This is a test message from Chapo-Samui system',
      test_time: new Date().toLocaleString()
    }

    const response = await emailjs.send(
      EMAILJS_CONFIG.SERVICE_ID,
      'template_test', // Template בסיסי לבדיקה
      testParams
    )

    return { success: true, response }
  } catch (error) {
    return { success: false, error: error.message }
  }
}