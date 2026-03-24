"use client";

import React from "react";
import PaymentModal from "@/components/PaymentModal";
import {
  AuthDialog,
  SettingsDialog,
  ShareDialog,
  UpgradeDialog,
  PrivacyDialog,
  BillingDialog,
  FontDialog,
  ShortcutDialog,
  ResetConfirmDialog,
  CreateFolderDialog,
  RegistrationPromptDialog,
  DataCollectionNoticeDialog,
  LogoutConfirmDialog,
  DeleteAccountDialog,
  SecretConfirmDialog,
  ProUpgradeDialog,
  DownloadSectionDialog,
  ShortcutsHelpDialog,
  ReplaceConversationDialog,
} from "@/components/modals";

type ModalHubProps = Record<string, any>;

export default function ModalHub(props: ModalHubProps) {
  const {
    showAuthDialog,
    setShowAuthDialog,
    authMode,
    setAuthMode,
    authForm,
    setAuthForm,
    showPassword,
    setShowPassword,
    handleAuth,
    handleGoogleAuth,
    handleWechatAuth,
    showSettingsDialog,
    setShowSettingsDialog,
    isEditingProfile,
    userProfileForm,
    setUserProfileForm,
    saveUserProfile,
    cancelEditingProfile,
    isDarkMode,
    setIsDarkMode,
    appUser,
    currentPlan,
    setShowUpgradeDialog,
    updateUserSettings,
    shortcutsEnabled,
    setShortcutsEnabled,
    setShowShortcutsHelp,
    setShowBillingDialog,
    setShowPrivacyDialog,
    onLanguageChange,
    showShortcutsHelp,
    showResetConfirmation,
    showUpgradeDialog,
    selectedPaidModel,
    billingPeriod,
    setBillingPeriod,
    pricingPlans,
    selectedPlanInDialog,
    setSelectedPlanInDialog,
    showProUpgradeDialog,
    setShowProUpgradeDialog,
    proChatType,
    setProChatType,
    proChatTrialCount,
    MAX_TRIAL_ATTEMPTS,
    showLogoutConfirmDialog,
    setShowLogoutConfirmDialog,
    handleLogout,
    showDeleteAccountDialog,
    setShowDeleteAccountDialog,
    deleteUserAccount,
    isDeletingAccount,
    setTheme,
    fontFamily,
    fontSize,
    handleFontFamilyChange,
    handleFontSizeChange,
    showPrivacyDialog,
    showBillingDialog,
    autoRenewEnabled,
    setAutoRenewEnabled,
    nextBillingDate,
    setNextBillingDate,
    showPaymentEditDialog,
    setShowPaymentEditDialog,
    paymentMethod,
    setPaymentMethod,
    showFontDialog,
    setShowFontDialog,
    showShortcutDialog,
    setShowShortcutDialog,
    showDownloadSection,
    setShowDownloadSection,
    selectedPlatform,
    handlePlatformSelect,
    handleDownload,
    handleUpgradeFromAds,
    showSecretConfirm,
    setShowSecretConfirm,
    shareSecret,
    shareLink,
    copyShareSecret,
    copyShareLink,
    showShareDialog,
    setShowShareDialog,
    isGeneratingLink,
    makeDiscoverable,
    setMakeDiscoverable,
    regenerateSecretKey,
    shareToSocialMedia,
    showRegistrationPrompt,
    setShowRegistrationPrompt,
    registrationPromptType,
    showDataCollectionNotice,
    setShowDataCollectionNotice,
    showResetConfirm,
    setShowResetConfirm,
    resetConfirmData,
    handleResetCancel,
    handleResetConfirm,
    showCreateFolderDialog,
    setShowCreateFolderDialog,
    newFolderName,
    setNewFolderName,
    newFolderColor,
    setNewFolderColor,
    createBookmarkFolder,
    showPaymentModal,
    handlePaymentModalClose,
    handlePaymentModalUpgrade,
    paymentError,
  } = props;

  return (
    <>
      {/* Auth Dialog */}
      <AuthDialog
        open={showAuthDialog}
        onOpenChange={setShowAuthDialog}
        authMode={authMode}
      setAuthMode={setAuthMode}
      authForm={authForm}
      setAuthForm={setAuthForm}
      showPassword={showPassword}
      setShowPassword={setShowPassword}
      handleAuth={handleAuth}
      handleGoogleAuth={handleGoogleAuth}
      handleWechatAuth={handleWechatAuth}
      isMobile={props.isMobile}
    />

      {/* Settings Dialog */}
      <SettingsDialog
        open={showSettingsDialog}
        onOpenChange={setShowSettingsDialog}
        isEditingProfile={isEditingProfile}
        userProfileForm={userProfileForm}
        setUserProfileForm={setUserProfileForm}
        saveUserProfile={saveUserProfile}
        cancelEditingProfile={cancelEditingProfile}
        isDarkMode={isDarkMode}
        onThemeChange={setTheme}
        fontFamily={fontFamily}
        fontSize={fontSize}
        onFontFamilyChange={handleFontFamilyChange}
        onFontSizeChange={handleFontSizeChange}
        appUser={appUser}
        currentPlan={currentPlan}
        setShowUpgradeDialog={setShowUpgradeDialog}
        updateUserSettings={updateUserSettings}
        shortcutsEnabled={shortcutsEnabled}
        setShortcutsEnabled={setShortcutsEnabled}
        setShowShortcutsHelp={setShowShortcutsHelp}
        setShowBillingDialog={setShowBillingDialog}
        setShowPrivacyDialog={setShowPrivacyDialog}
        onLanguageChange={onLanguageChange}
      />

      {/* Hotkeys Configuration Dialog */}
      <ShortcutsHelpDialog
        open={showShortcutsHelp}
        onOpenChange={setShowShortcutsHelp}
        shortcutsEnabled={shortcutsEnabled}
        setShortcutsEnabled={setShortcutsEnabled}
        shortcutConflict={null}
        onShowResetConfirmation={showResetConfirmation}
        onResetToDefaults={() => {}}
        onImportHotkeys={() => {}}
        onExportHotkeys={() => {}}
        onResetNavigationShortcuts={() => {}}
        onResetAIModelShortcuts={() => {}}
        onResetPromptsShortcuts={() => {}}
        renderShortcutDisplay={() => null}
      />

      {/* Upgrade Dialog */}
      <UpgradeDialog
        open={showUpgradeDialog}
        onOpenChange={setShowUpgradeDialog}
        selectedPaidModel={selectedPaidModel}
        billingPeriod={billingPeriod}
        setBillingPeriod={setBillingPeriod}
        pricingPlans={pricingPlans}
        selectedPlanInDialog={selectedPlanInDialog}
        setSelectedPlanInDialog={setSelectedPlanInDialog}
        appUserId={appUser?.id || null}
        currentPlan={appUser?.plan || null}
        currentPlanExp={appUser?.planExp || null}
      />

      {/* Pro Upgrade Dialog */}
      <ProUpgradeDialog
        open={showProUpgradeDialog}
        onOpenChange={(open) => {
          if (!open) {
            setShowProUpgradeDialog(false);
            setProChatType(null);
          }
        }}
        type={proChatType}
        trialCount={proChatTrialCount[proChatType || "voice"]}
        maxTrials={MAX_TRIAL_ATTEMPTS}
        onMaybeLater={() => setShowProUpgradeDialog(false)}
        onUpgrade={() => {
          setShowProUpgradeDialog(false);
          setShowUpgradeDialog(true);
        }}
      />

      {/* Logout Confirmation Dialog */}
      <LogoutConfirmDialog
        open={showLogoutConfirmDialog}
        onOpenChange={setShowLogoutConfirmDialog}
        onConfirm={() => {
          setShowLogoutConfirmDialog(false);
          handleLogout();
        }}
      />

      {/* Delete Account Confirmation Dialog */}
      <DeleteAccountDialog
        open={showDeleteAccountDialog}
        onOpenChange={setShowDeleteAccountDialog}
        onConfirm={deleteUserAccount}
        loading={isDeletingAccount}
      />

      {/* Privacy Section Dialog */}
      <PrivacyDialog
        open={showPrivacyDialog}
        onOpenChange={setShowPrivacyDialog}
        appUser={appUser}
        setShowDeleteAccountDialog={setShowDeleteAccountDialog}
        setShowBillingDialog={setShowBillingDialog}
      />

      {/* Billing Management Dialog */}
      <BillingDialog
        open={showBillingDialog}
        onOpenChange={setShowBillingDialog}
        appUser={appUser}
        currentPlan={currentPlan}
        autoRenewEnabled={autoRenewEnabled}
        setAutoRenewEnabled={setAutoRenewEnabled}
        nextBillingDate={nextBillingDate}
        setNextBillingDate={setNextBillingDate}
        showUpgradeDialog={showUpgradeDialog}
        setShowUpgradeDialog={setShowUpgradeDialog}
        showPaymentEditDialog={showPaymentEditDialog}
        setShowPaymentEditDialog={setShowPaymentEditDialog}
        paymentMethod={paymentMethod}
        setPaymentMethod={setPaymentMethod}
      />

      {/* Font Settings Dialog */}
      <FontDialog open={showFontDialog} onOpenChange={setShowFontDialog} />

      {/* Shortcut Settings Dialog */}
      <ShortcutDialog
        open={showShortcutDialog}
        onOpenChange={setShowShortcutDialog}
      />

      {/* Download Section Dialog */}
      <DownloadSectionDialog
        open={showDownloadSection}
        onOpenChange={setShowDownloadSection}
        selectedPlatform={selectedPlatform}
        appUser={appUser}
        onPlatformSelect={handlePlatformSelect}
        onDownload={handleDownload}
        onUpdateUserSettings={updateUserSettings}
        onUpgradeFromAds={handleUpgradeFromAds}
      />

      {/* Secret Confirmation Dialog */}
      <SecretConfirmDialog
        open={showSecretConfirm}
        onOpenChange={setShowSecretConfirm}
        shareSecret={shareSecret}
        shareLink={shareLink}
        onCopySecret={copyShareSecret}
        onCopyLink={copyShareLink}
      />

      {/* Registration Prompt Dialog */}
      <RegistrationPromptDialog
        open={showRegistrationPrompt}
        onOpenChange={setShowRegistrationPrompt}
        type={registrationPromptType}
        onContinueAsGuest={() => setShowRegistrationPrompt(false)}
        onCreateAccount={() => {
          setShowRegistrationPrompt(false);
          setShowAuthDialog(true);
        }}
      />

      {/* Data Collection Notice Dialog */}
      <DataCollectionNoticeDialog
        open={showDataCollectionNotice}
        onOpenChange={setShowDataCollectionNotice}
        onContinueAsGuest={() => setShowDataCollectionNotice(false)}
        onCreateAccount={() => {
          setShowDataCollectionNotice(false);
          setShowAuthDialog(true);
        }}
      />

      {/* Reset Confirmation Dialog */}
      <ResetConfirmDialog
        open={showResetConfirm}
        onOpenChange={setShowResetConfirm}
        title={resetConfirmData?.title}
        message={resetConfirmData?.message}
        onCancel={handleResetCancel}
        onConfirm={handleResetConfirm}
      />

      {/* Create Bookmark Folder Dialog */}
      <CreateFolderDialog
        open={showCreateFolderDialog}
        onOpenChange={setShowCreateFolderDialog}
        folderName={newFolderName}
        setFolderName={setNewFolderName}
        folderColor={newFolderColor}
        setFolderColor={setNewFolderColor}
        onCreate={createBookmarkFolder}
      />

      {/* Share Dialog */}
      <ShareDialog
        open={showShareDialog}
        onOpenChange={setShowShareDialog}
        isGeneratingLink={isGeneratingLink}
        shareLink={shareLink}
        shareSecret={shareSecret}
        makeDiscoverable={makeDiscoverable}
        setMakeDiscoverable={setMakeDiscoverable}
        copyShareLink={copyShareLink}
        copyShareSecret={copyShareSecret}
        regenerateSecretKey={regenerateSecretKey}
        shareToSocialMedia={shareToSocialMedia}
      />

      {/* Payment Modal for Token Limits */}
      <PaymentModal
        isOpen={showPaymentModal}
        onClose={handlePaymentModalClose}
        onUpgrade={handlePaymentModalUpgrade}
        currentUsage={paymentError?.currentUsage}
        limit={paymentError?.limit}
        modelName={paymentError?.modelName}
      />

      {/* Replace Conversation Dialog for Free Users */}
      <ReplaceConversationDialog
        open={props.replaceConversationState?.needConfirm || false}
        onOpenChange={(open) => {
          if (!open) props.cancelReplaceConversation?.();
        }}
        oldestConversation={props.replaceConversationState?.oldestConversation}
        currentCount={props.replaceConversationState?.currentCount || 0}
        conversationLimit={props.replaceConversationState?.conversationLimit || 5}
        onCancel={props.cancelReplaceConversation}
        onConfirm={props.confirmReplaceConversation}
      />
    </>
  );
}
