// Import required packages
const express = require('express');
const bodyParser = require('body-parser');
const {
    CognitoIdentityProviderClient,
    SignUpCommand,
    AdminConfirmSignUpCommand,
    AdminUpdateUserAttributesCommand,
    AdminInitiateAuthCommand,
} = require('@aws-sdk/client-cognito-identity-provider');

// Create an instance of the Express app
const app = express();
app.use(bodyParser.json());

// Hardcoded AWS credentials and Cognito configuration
const COGNITO_CONFIG = {
    accessKeyId: 'YOUR_ACCESS_KEY_ID',
    secretAccessKey: 'YOUR_SECRET_ACCESS_KEY',
    region: 'us-east-2',
    UserPoolId: 'YOUR_USER_POOL_ID',
    ClientId: 'YOUR_CLIENT_ID',
};

// Initialize the Cognito client with credentials
const cognitoClient = new CognitoIdentityProviderClient({
    credentials: {
        accessKeyId: COGNITO_CONFIG.accessKeyId,
        secretAccessKey: COGNITO_CONFIG.secretAccessKey,
    },
    region: COGNITO_CONFIG.region,
});

// Sign-up endpoint
app.post('/signup', async (req, res) => {
    const { email, password } = req.body;

    const signUpParams = {
        ClientId: COGNITO_CONFIG.ClientId,
        Username: email,
        Password: password,
        UserAttributes: [
            {
                Name: 'email',
                Value: email,
            },
        ],
    };

    try {
        // Sign up the user
        const signUpCommand = new SignUpCommand(signUpParams);
        const signUpResponse = await cognitoClient.send(signUpCommand);

        // Auto-confirm the user
        const confirmParams = {
            UserPoolId: COGNITO_CONFIG.UserPoolId,
            Username: email,
        };
        const confirmCommand = new AdminConfirmSignUpCommand(confirmParams);
        await cognitoClient.send(confirmCommand);

        // Mark the email as verified
        const updateAttributesParams = {
            UserPoolId: COGNITO_CONFIG.UserPoolId,
            Username: email,
            UserAttributes: [
                {
                    Name: 'email_verified',
                    Value: 'true',
                },
            ],
        };
        const updateAttributesCommand = new AdminUpdateUserAttributesCommand(updateAttributesParams);
        await cognitoClient.send(updateAttributesCommand);

        // Send successful response
        return res.status(200).json({
            message: 'User signed up, confirmed, and email verified successfully',
            userSub: signUpResponse.UserSub,
        });
    } catch (error) {
        // Error handling
        console.error('Error signing up or confirming user:', error);
        return res.status(400).json({
            message: 'Error signing up or confirming user',
            error: error.message,
        });
    }
});

// Login endpoint
app.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validate request body
        if (!email || !password) {
            return res.status(400).json({ success: false, error: 'Invalid request body' });
        }

        // Set up authentication parameters
        const loginParams = {
            AuthFlow: 'ADMIN_NO_SRP_AUTH',
            UserPoolId: COGNITO_CONFIG.UserPoolId,
            ClientId: COGNITO_CONFIG.ClientId,
            AuthParameters: {
                USERNAME: email,
                PASSWORD: password,
            },
        };

        // Authenticate the user using AdminInitiateAuthCommand
        const loginCommand = new AdminInitiateAuthCommand(loginParams);
        const authResponse = await cognitoClient.send(loginCommand);

        // Successful login response
        return res.status(200).json({
            success: true,
            idToken: authResponse.AuthenticationResult.IdToken,
            accessToken: authResponse.AuthenticationResult.AccessToken,
            refreshToken: authResponse.AuthenticationResult.RefreshToken,
        });
    } catch (error) {
        console.error('Error logging in user:', error);
        return res.status(401).json({
            success: false,
            error: error.message || 'Unauthorized',
        });
    }
});

// Start the server
const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
