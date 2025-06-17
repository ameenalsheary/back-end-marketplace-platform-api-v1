const mongoose = require("mongoose");

const productsGroupSchema = mongoose.Schema(
  {
    groupName: {
      type: String,
      required: [true, "Group name is required."],
      trim: true,
      lowercase: true,
      minlength: [2, "Group name must be at least 2 characters."],
      maxlength: [32, "Group name cannot exceed 32 characters."],
    },
    productsIDs: [
      {
        type: mongoose.Schema.ObjectId,
        ref: `Product`,
      },
    ],
  },
  {
    timestamps: true,
  }
);

productsGroupSchema.pre('find', function () {
  this.populate({
    path: "productsIDs",
    select: "imageCover"
  })
});

module.exports = mongoose.model("ProductsGroup", productsGroupSchema);
