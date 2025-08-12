/**
 * Payment Controller
 * Handles user subscriptions, billing, and payment processing for remote users
 */

const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const { getUserByEmail, updateUser } = require('../models/userModel');
const { createSubscription, getSubscription, updateSubscription, cancelSubscription } = require('../models/subscriptionModel');
const { createPayment, getPayments } = require('../models/paymentModel');

class PaymentController {
  // Create subscription
  async createSubscription(req, res) {
    try {
      const userId = req.user.userId;
      const { planId, billingCycle, paymentMethod } = req.body;

      // Validation
      if (!planId || !billingCycle || !paymentMethod) {
        return res.status(400).json({
          success: false,
          message: 'Plan ID, billing cycle, and payment method are required'
        });
      }

      // Get user
      const user = await getUserByEmail(req.user.email);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Define available plans
      const plans = {
        basic: {
          name: 'Basic',
          price: billingCycle === 'annual' ? 6.99 : 9.98,
          features: ['Access to all MornGPT models', '100 Multi-GPT queries/month', 'Basic support', 'Chat history', 'Remove Ads'],
          tier: 'basic'
        },
        pro: {
          name: 'Pro',
          price: billingCycle === 'annual' ? 27.99 : 39.98,
          features: [
            'Everything in Basic',
            'Unlimited Multi-GPT usage',
            'Priority access to new models',
            'Advanced analytics',
            '24/7 priority support',
            'Export conversations'
          ],
          tier: 'premium'
        },
        enterprise: {
          name: 'Enterprise',
          price: billingCycle === 'annual' ? 69.99 : 99.98,
          features: [
            'Everything in Pro',
            'Custom model training',
            'API access',
            'Team collaboration',
            'Advanced security',
            'Dedicated support'
          ],
          tier: 'enterprise'
        }
      };

      const selectedPlan = plans[planId];
      if (!selectedPlan) {
        return res.status(400).json({
          success: false,
          message: 'Invalid plan selected'
        });
      }

      // Process payment (simulated)
      const paymentResult = await this.processPayment(paymentMethod, selectedPlan.price);
      
      if (!paymentResult.success) {
        return res.status(400).json({
          success: false,
          message: paymentResult.message
        });
      }

      // Create subscription
      const subscription = {
        id: uuidv4(),
        userId,
        planId,
        planName: selectedPlan.name,
        tier: selectedPlan.tier,
        billingCycle,
        price: selectedPlan.price,
        status: 'active',
        startDate: new Date(),
        endDate: this.calculateEndDate(billingCycle),
        autoRenew: true,
        paymentMethod: {
          type: paymentMethod.type,
          last4: paymentMethod.last4,
          brand: paymentMethod.brand,
          expiry: paymentMethod.expiry
        },
        createdAt: new Date()
      };

      await createSubscription(subscription);

      // Create payment record
      const payment = {
        id: uuidv4(),
        userId,
        subscriptionId: subscription.id,
        amount: selectedPlan.price,
        currency: 'USD',
        status: 'completed',
        paymentMethod: paymentMethod.type,
        transactionId: paymentResult.transactionId,
        createdAt: new Date()
      };

      await createPayment(payment);

      // Update user tier
      await updateUser(userId, {
        tier: selectedPlan.tier,
        isPro: true,
        isPaid: true,
        currentPlan: selectedPlan.name
      });

      logger.info(`Subscription created for user ${userId}: ${selectedPlan.name} plan`);

      res.status(201).json({
        success: true,
        message: 'Subscription created successfully',
        subscription,
        payment,
        plan: selectedPlan
      });

    } catch (error) {
      logger.error('Create subscription error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error creating subscription'
      });
    }
  }

  // Get user subscription
  async getSubscription(req, res) {
    try {
      const userId = req.user.userId;

      const subscription = await getSubscription(userId);

      if (!subscription) {
        return res.status(404).json({
          success: false,
          message: 'No active subscription found'
        });
      }

      res.status(200).json({
        success: true,
        subscription
      });

    } catch (error) {
      logger.error('Get subscription error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error getting subscription'
      });
    }
  }

  // Update subscription
  async updateSubscription(req, res) {
    try {
      const userId = req.user.userId;
      const { planId, billingCycle, autoRenew } = req.body;

      const subscription = await getSubscription(userId);
      if (!subscription) {
        return res.status(404).json({
          success: false,
          message: 'No active subscription found'
        });
      }

      const updateData = {};
      if (planId) updateData.planId = planId;
      if (billingCycle) updateData.billingCycle = billingCycle;
      if (autoRenew !== undefined) updateData.autoRenew = autoRenew;

      const updatedSubscription = await updateSubscription(subscription.id, updateData);

      res.status(200).json({
        success: true,
        message: 'Subscription updated successfully',
        subscription: updatedSubscription
      });

    } catch (error) {
      logger.error('Update subscription error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error updating subscription'
      });
    }
  }

  // Cancel subscription
  async cancelSubscription(req, res) {
    try {
      const userId = req.user.userId;
      const { reason } = req.body;

      const subscription = await getSubscription(userId);
      if (!subscription) {
        return res.status(404).json({
          success: false,
          message: 'No active subscription found'
        });
      }

      // Cancel subscription
      await cancelSubscription(subscription.id, reason);

      // Update user tier to free
      await updateUser(userId, {
        tier: 'free',
        isPro: false,
        isPaid: false,
        currentPlan: null
      });

      logger.info(`Subscription cancelled for user ${userId}`);

      res.status(200).json({
        success: true,
        message: 'Subscription cancelled successfully'
      });

    } catch (error) {
      logger.error('Cancel subscription error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error cancelling subscription'
      });
    }
  }

  // Get payment history
  async getPaymentHistory(req, res) {
    try {
      const userId = req.user.userId;
      const { limit = 20, offset = 0 } = req.query;

      const payments = await getPayments(userId, parseInt(limit), parseInt(offset));

      res.status(200).json({
        success: true,
        payments,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          total: payments.length
        }
      });

    } catch (error) {
      logger.error('Get payment history error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error getting payment history'
      });
    }
  }

  // Update payment method
  async updatePaymentMethod(req, res) {
    try {
      const userId = req.user.userId;
      const { paymentMethod } = req.body;

      if (!paymentMethod) {
        return res.status(400).json({
          success: false,
          message: 'Payment method is required'
        });
      }

      const subscription = await getSubscription(userId);
      if (!subscription) {
        return res.status(404).json({
          success: false,
          message: 'No active subscription found'
        });
      }

      // Update payment method
      await updateSubscription(subscription.id, {
        paymentMethod: {
          type: paymentMethod.type,
          last4: paymentMethod.last4,
          brand: paymentMethod.brand,
          expiry: paymentMethod.expiry
        }
      });

      res.status(200).json({
        success: true,
        message: 'Payment method updated successfully'
      });

    } catch (error) {
      logger.error('Update payment method error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error updating payment method'
      });
    }
  }

  // Get available plans
  async getAvailablePlans(req, res) {
    try {
      const plans = {
        basic: {
          id: 'basic',
          name: 'Basic',
          monthlyPrice: 9.98,
          annualPrice: 6.99,
          features: [
            'Access to all MornGPT models',
            '100 Multi-GPT queries/month',
            'Basic support',
            'Chat history',
            'Remove Ads'
          ],
          popular: false
        },
        pro: {
          id: 'pro',
          name: 'Pro',
          monthlyPrice: 39.98,
          annualPrice: 27.99,
          features: [
            'Everything in Basic',
            'Unlimited Multi-GPT usage',
            'Priority access to new models',
            'Advanced analytics',
            '24/7 priority support',
            'Export conversations'
          ],
          popular: true
        },
        enterprise: {
          id: 'enterprise',
          name: 'Enterprise',
          monthlyPrice: 99.98,
          annualPrice: 69.99,
          features: [
            'Everything in Pro',
            'Custom model training',
            'API access',
            'Team collaboration',
            'Advanced security',
            'Dedicated support'
          ],
          popular: false
        }
      };

      res.status(200).json({
        success: true,
        plans
      });

    } catch (error) {
      logger.error('Get available plans error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error getting available plans'
      });
    }
  }

  // Process payment (simulated)
  async processPayment(paymentMethod, amount) {
    try {
      // Simulate payment processing
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Simulate payment validation
      if (paymentMethod.last4 === '0000') {
        return {
          success: false,
          message: 'Payment failed: Invalid card number'
        };
      }

      // Simulate successful payment
      return {
        success: true,
        transactionId: `txn_${uuidv4().replace(/-/g, '')}`,
        message: 'Payment processed successfully'
      };

    } catch (error) {
      logger.error('Payment processing error:', error);
      return {
        success: false,
        message: 'Payment processing failed'
      };
    }
  }

  // Calculate subscription end date
  calculateEndDate(billingCycle) {
    const endDate = new Date();
    
    if (billingCycle === 'monthly') {
      endDate.setMonth(endDate.getMonth() + 1);
    } else if (billingCycle === 'annual') {
      endDate.setFullYear(endDate.getFullYear() + 1);
    }
    
    return endDate;
  }

  // Handle webhook from payment processor
  async handleWebhook(req, res) {
    try {
      const { event, data } = req.body;

      // Verify webhook signature (in production)
      // const signature = req.headers['stripe-signature'];
      // const verified = stripe.webhooks.constructEvent(req.body, signature, process.env.STRIPE_WEBHOOK_SECRET);

      switch (event) {
        case 'invoice.payment_succeeded':
          await this.handlePaymentSucceeded(data);
          break;
        case 'invoice.payment_failed':
          await this.handlePaymentFailed(data);
          break;
        case 'customer.subscription.deleted':
          await this.handleSubscriptionDeleted(data);
          break;
        default:
          logger.info(`Unhandled webhook event: ${event}`);
      }

      res.status(200).json({ received: true });

    } catch (error) {
      logger.error('Webhook error:', error);
      res.status(400).json({ error: 'Webhook processing failed' });
    }
  }

  // Handle successful payment
  async handlePaymentSucceeded(data) {
    try {
      const { subscription_id, amount_paid } = data;

      // Update subscription status
      await updateSubscription(subscription_id, {
        status: 'active',
        lastPaymentDate: new Date(),
        nextBillingDate: this.calculateEndDate('monthly') // Adjust based on billing cycle
      });

      logger.info(`Payment succeeded for subscription: ${subscription_id}`);

    } catch (error) {
      logger.error('Handle payment succeeded error:', error);
    }
  }

  // Handle failed payment
  async handlePaymentFailed(data) {
    try {
      const { subscription_id, attempt_count } = data;

      if (attempt_count >= 3) {
        // Cancel subscription after 3 failed attempts
        await cancelSubscription(subscription_id, 'Payment failed after 3 attempts');
        logger.info(`Subscription cancelled due to payment failure: ${subscription_id}`);
      } else {
        // Update subscription status
        await updateSubscription(subscription_id, {
          status: 'past_due',
          lastPaymentAttempt: new Date()
        });
        logger.info(`Payment failed for subscription: ${subscription_id}, attempt ${attempt_count}`);
      }

    } catch (error) {
      logger.error('Handle payment failed error:', error);
    }
  }

  // Handle subscription deletion
  async handleSubscriptionDeleted(data) {
    try {
      const { subscription_id } = data;

      // Update user tier to free
      const subscription = await getSubscription(null, subscription_id);
      if (subscription) {
        await updateUser(subscription.userId, {
          tier: 'free',
          isPro: false,
          isPaid: false,
          currentPlan: null
        });
      }

      logger.info(`Subscription deleted: ${subscription_id}`);

    } catch (error) {
      logger.error('Handle subscription deleted error:', error);
    }
  }
}

module.exports = new PaymentController(); 