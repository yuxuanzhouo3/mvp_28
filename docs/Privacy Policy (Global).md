# Privacy Policy (Global Edition)

**Applicable Edition**: MornGPT Global Edition

**Compliance**: GDPR (EU), CCPA (California), COPPA, and other applicable international data protection regulations.

**Effective Date**: December 23, 2025

**Last Updated**: December 23, 2025

---

MornGPT ("we," "us," or "our") is committed to protecting your privacy. This policy applies to our services across Android, iOS, Windows, Mac, and Web platforms.

---

## 1. Data Collection and Usage

### 1.1 Account Registration & Authentication

#### 1.1.1 Email Registration
When you register or sign in with email, we collect:
- **Email address**: For account registration, authentication, and account recovery
- **Encrypted password**: Stored using bcrypt hashing (salt rounds: 10). We cannot access your plain-text password.

#### 1.1.2 Google Sign-In (OAuth)
When you sign in with Google, we collect through Google's OAuth service:
- **Google unique ID**: Your unique identifier within our application
- **Email address**: Associated with your Google account
- **Display name**: Your Google profile name
- **Profile picture**: Your Google avatar (optional)

> **Legal Basis**: We process this data based on contract performance (GDPR Article 6(1)(b)) - providing the service you requested.

### 1.2 AI Model Interaction & Data Handling

#### 1.2.1 General AI Conversations
Your conversations with general AI models are processed as follows:
- Messages are sent to third-party AI API providers (e.g., Mistral AI) for inference
- **We do not store your chat logs on our servers for training purposes**
- Conversation history is saved to your account only when logged in, for viewing history and session recovery
- Guest users' conversations are NOT saved

#### 1.2.2 Expert Model Services (Special Clause)

> **IMPORTANT NOTICE**: Our service includes **17 specialized Expert Models**. By utilizing any of these Expert Models, you **explicitly consent to the collection and archival of your complete dialogue history** (including your input and AI output).

**The 17 Expert Models include**:

| No. | Expert Model Name | Data Storage Purpose |
|:---:|-------------------|----------------------|
| 1 | Growth Advisory | Stored to optimize business recommendations |
| 2 | Interview/Job | Stored to optimize career guidance |
| 3 | AI Coder | Stored to optimize code suggestions |
| 4 | Content Detection | Stored to optimize detection capabilities |
| 5 | Medical Advice | Stored to optimize health recommendations |
| 6 | Multi-GPT | Stored to optimize multi-model collaboration |
| 7 | AI Lawyer | Stored to optimize legal consultation |
| 8 | Entertainment Advisor | Stored to optimize recommendations |
| 9 | Housing | Stored to optimize real estate advice |
| 10 | Person Matching | Stored to optimize matching algorithms |
| 11 | AI Teacher | Stored to optimize teaching effectiveness |
| 12 | Travel Planning | Stored to optimize travel suggestions |
| 13 | Product Search | Stored to optimize search results |
| 14 | Fashion | Stored to optimize style recommendations |
| 15 | Food & Dining | Stored to optimize dining recommendations |
| 16 | Content Generation | Stored to optimize content quality |
| 17 | AI Protection | Stored to optimize security advice |

**Data Usage Purposes**:
- Continuous fine-tuning and contextual accuracy improvement
- Expert system context analysis
- Service quality enhancement

**Legal Basis**: Your use of Expert Models constitutes explicit consent (GDPR Article 6(1)(a)).

### 1.3 Multimodal Content Processing

> **Note**: The international edition currently does not support multimodal file uploads. This section will apply when the feature is enabled.

#### 1.3.1 Image Upload
- Images will be sent to multimodal AI models for analysis
- Images are stored in cloud storage services (Supabase Storage)
- **Images are used solely for AI analysis and your history viewing, not for other commercial purposes**
- Supported formats: PNG, JPEG, GIF, WebP (max 100MB per file)

#### 1.3.2 Video Upload
- Videos will be used for multimodal content understanding
- Videos are stored in cloud storage services
- **Videos are used solely for AI analysis and your history viewing**
- Supported formats: MP4, MPEG (max 100MB per file)

#### 1.3.3 Audio Upload
- Audio files will be used for speech recognition and content understanding
- Audio files are stored in cloud storage services
- **Audio files are used solely for AI analysis and your history viewing**
- Supported formats: MPEG, WAV (max 100MB per file)

**File Upload Limits**:
- Maximum 10 files per upload
- Maximum 100MB per file
- Maximum 500MB total size
- Single media type per upload (images, videos, OR audio - not mixed)

---

## 2. Device Permissions

We may request the following permissions to provide specific features. **All permissions are only triggered when you actively initiate them; we do not access them in the background.**

### 2.1 Microphone Permission
- **Trigger**: Clicking the "Voice Input" or "Pro Voice Chat" button in the input area
- **Purpose**:
  - Voice Input: Convert your speech to text
  - Pro Voice Chat: Real-time voice conversation
- **Processing**: Voice data is processed through the browser's Web Speech API or uploaded to speech recognition services

### 2.2 Camera Permission
- **Trigger**: Clicking the "Camera" button in the input area
- **Purpose**:
  - Photo Mode: Capture photos for AI analysis
  - Video Mode: Record videos for AI analysis
  - Pro Video Chat: Real-time video conversation
- **Processing**: Captured content is sent as attachments to AI for analysis

### 2.3 Location Permission
- **Trigger**: Clicking the "Location" button in the input area
- **Purpose**: Obtain your current location for AI to generate location-based service suggestions
- **Processing**:
  - Location is attached to your message and sent to AI
  - **We do not store your location information long-term**
  - You can clear location information at any time

### 2.4 Storage Permission
- **Purpose**: Save AI-generated images, videos, and audio to your local device
- **Commitment**: We do not read other files on your device

---

## 3. Payment & Privacy

### 3.1 Supported Payment Methods

#### 3.1.1 Stripe
- **Data Collected**: Order ID, payment time, payment amount
- **Data NOT Collected**: We do not obtain your credit card number, CVV, or banking credentials
- **Data Transmission**: Direct communication with Stripe servers via official Stripe SDK
- **Security**: Stripe is PCI DSS Level 1 certified
- **Privacy Policy**: See [Stripe Privacy Policy](https://stripe.com/privacy)

#### 3.1.2 PayPal
- **Data Collected**: Order ID, payment time, payment amount
- **Data NOT Collected**: We do not obtain your PayPal account credentials or linked payment details
- **Data Transmission**: Direct communication with PayPal servers via official PayPal SDK
- **Privacy Policy**: See [PayPal Privacy Policy](https://www.paypal.com/us/legalhub/privacy-full)

### 3.2 Transaction Record Retention
We retain the following transaction information for after-sales service and financial compliance:
- Unique order identifier
- Payment provider order ID
- Payment amount and currency type
- Payment status and completion time
- Purchased product type (subscription/addon pack)

### 3.3 Currency Handling
- International edition prices are in USD
- Automatic currency conversion may be applied by your payment provider
- Exchange rates are determined by the payment provider at the time of transaction

---

## 4. Advertising & Third-Party Services

### 4.1 Advertising Display Rules
- **Ad Positions**: Top, bottom, left, right, sidebar, bottom-left, bottom-right
- **Ad Types**: Image ads, video ads
- **Ad Management**: You can choose whether to display ads in Settings

### 4.2 Ad-Free Benefits for Subscribers
- Basic/Pro/Enterprise subscribers can enable "Hide Ads" in Settings
- When enabled, no advertisements will be displayed in the application

### 4.3 Advertising Data Collection
- Our advertising system is managed by our own servers
- **We do NOT share your personal information with third-party advertisers**
- Ad display is based on position parameters, NOT on your personal profile

### 4.4 Third-Party Analytics
We may use analytics tools to understand how users interact with our service. These tools may collect:
- Device type and operating system
- Browser type and version
- General geographic region
- Usage patterns (pages visited, features used)

**We do NOT sell your data to third parties.**

---

## 5. Content Guidelines & Compliance

### 5.1 AI-Generated Content Disclaimer
> **IMPORTANT**: All AI-generated content (including text, images, code, etc.) is **for reference only** and does not constitute professional medical, legal, financial, or other professional advice. Users bear all responsibility for any consequences arising from the use of AI-generated content.

### 5.2 External Model API Information
- This application integrates multiple third-party AI model APIs (e.g., Mistral AI)
- Data processing by external APIs follows each provider's privacy policy
- **In general conversation mode, external API providers do NOT use your conversations for model training** (please refer to each provider's privacy policy for specifics)

### 5.3 Prohibited Content
Do NOT send to AI or attempt to generate:
- Illegal content under applicable laws
- Pornographic, violent, or graphic content
- Content that infringes on others' legal rights
- Hate speech or discriminatory content
- Other content that violates public order and morals

**Consequences**:
- System will automatically block prohibited keywords
- Multiple violations will result in account suspension
- We reserve the right to report illegal activities to relevant authorities

---

## 6. Chat History Management

### 6.1 Chat History Storage
- **Logged-in Users**: Chat history is saved in cloud database, synced across devices
- **Guest Users**: Chat history is only saved locally in the browser and may be lost when closed

### 6.2 Difference Between Chat History and Expert Model Data

| Comparison | General Chat History | Expert Model Conversations |
|:----------:|:--------------------:|:--------------------------:|
| Storage Purpose | For user to view history | For model optimization |
| Data Usage | Not used for training | May be used for analysis |
| Deletion Rights | Can delete | Contact support required |

### 6.3 Context Message Limits
To ensure service quality, context message limits vary by plan:
- Free: Last 10 messages
- Basic: Last 50 messages
- Pro: Last 100 messages
- Enterprise: Last 200 messages

> Messages beyond the limit are still stored in the database but are not sent to AI as context.

---

## 7. Client Downloads

### 7.1 Supported Platforms
- **Android**: Direct APK download and installation
- **iOS**: Download from App Store
- **Windows**: EXE installer download
- **Mac**: DMG installer download

### 7.2 Download Security
- All download links are provided by official servers
- Installation packages are digitally signed
- Do NOT download from unofficial sources to avoid security risks

### 7.3 Application Permissions (Clients)
Clients on different platforms may request the following permissions:
- **Network Access**: For server communication
- **Storage Permission**: For saving generated files
- **Microphone Permission**: For voice input features
- **Camera Permission**: For photo/video capture
- **Location Permission**: For location information (optional)

---

## 8. Account Deletion

### 8.1 Deletion Entry Point
Settings → Privacy & Security → Danger Zone → Delete Account

### 8.2 Deletion Warning
> **DANGER WARNING**: Account deletion is an **irreversible** operation. Once deleted, the following data will be **permanently erased and CANNOT be recovered**:
> - Basic account information (email, name, avatar)
> - All chat history and conversation records
> - Bookmarks and custom prompts
> - **Remaining subscription time will be forfeited with NO refund**
> - **Remaining addon pack credits will be cleared with NO refund**
> - Personal settings and preferences
> - All uploaded images, videos, and audio files

### 8.3 Deletion Process
1. Navigate to "Privacy & Security" settings
2. Click "Delete Account" button
3. System displays confirmation dialog clearly stating irreversibility
4. Upon confirmation, deletion executes immediately
5. After deletion, you are automatically logged out

---

## 9. Your Rights

### 9.1 Right of Access (GDPR Article 15)
You have the right to access the personal information we have collected about you.

### 9.2 Right to Rectification (GDPR Article 16)
You have the right to correct your personal information (e.g., name, avatar).

### 9.3 Right to Erasure (GDPR Article 17)
You have the right to request deletion of your personal information (see Section 8).

### 9.4 Right to Data Portability (GDPR Article 20)
You can export your personal data in the "Privacy & Security" settings.

### 9.5 Right to Withdraw Consent (GDPR Article 7)
You may withdraw consent for non-essential permissions (e.g., location) at any time.

### 9.6 Right to Object (GDPR Article 21)
You have the right to object to certain data processing activities.

### 9.7 CCPA Rights (California Residents)
If you are a California resident, you have additional rights under the California Consumer Privacy Act (CCPA):
- Right to know what personal information is collected
- Right to know whether personal information is sold or disclosed
- Right to opt out of the sale of personal information
- Right to non-discrimination for exercising your rights

**We do NOT sell your personal information.**

---

## 10. International Data Transfers

Your data may be transferred to and processed in countries outside your country of residence. We ensure appropriate safeguards are in place, including:
- Standard Contractual Clauses (SCCs) approved by the European Commission
- Compliance with applicable data protection regulations

---

## 11. Children's Privacy

Our service is NOT directed to children under the age of 13 (or 16 in the EU). If you are a guardian and discover that your child has provided us with personal information, please contact us for deletion.

---

## 12. Data Security

We implement appropriate technical and organizational measures to protect your personal data, including:
- Encryption of data in transit (TLS/SSL)
- Secure password hashing (bcrypt)
- Access controls and authentication
- Regular security assessments

However, no system is completely secure. We cannot guarantee absolute security of your data.

---

## 13. Data Retention

We retain your personal data only for as long as necessary:
- **Account data**: Until you delete your account
- **Chat history**: Until you delete it or delete your account
- **Transaction records**: As required by applicable laws (typically 7 years)
- **Server logs**: Typically 90 days for security and debugging purposes

---

## 14. Privacy Policy Updates

We may update this Privacy Policy from time to time. Updated policies will be posted on this page. Significant changes will be communicated through in-app notifications or email.

---

## 15. Contact Us

If you have any questions or suggestions about this Privacy Policy, please contact us:

- **Email**: mornscience@gmail.com
- **Business Hours**: Monday to Friday, 9:00 AM - 6:00 PM (UTC+8)

For EU residents, you also have the right to lodge a complaint with a supervisory authority.

---

**Copyright © 2025 Yuxuan Zhou. All Rights Reserved.**
