const GoogleStrategy = require("passport-google-oauth20").Strategy;
const slugify = require("slugify");

const userModel = require("../models/userModel");

const googleStrategy = new GoogleStrategy(
  {
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "/auth/google/callback",
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      // Safely get email or use a default if not available
      const userEmail = profile.emails?.[0]?.value || `${profile.id}@google.com`;
      
      if (!userEmail) {
        return done(new Error("No email provided by Google"), null);
      }

      let user = await userModel.findOne({ email: userEmail });

      if (!user) {
        // Safely extract profile data with defaults
        const givenName = profile.name?.givenName || "User";
        const familyName = profile.name?.familyName || "Private";
        const fullName = `${givenName} ${familyName}`;
        
        const userData = {
          firstName: givenName,
          lastName: familyName,
          slug: slugify(fullName, { lower: true, strict: true }),
          email: userEmail,
          emailVerification: true,
          profileImage: profile.photos?.[0]?.value,
          isGoogleUser: true,
        };

        user = await userModel.create(userData);
      }

      return done(null, user);
    } catch (error) {
      return done(error, null);
    }
  }
);

module.exports = googleStrategy;
