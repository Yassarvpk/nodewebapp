const User = require("../../models/userSchema");



const customerInfo = async (req, res) => {
  try {
    let search = req.query.search || "";
    let page = parseInt(req.query.page) || 1;
    const limit = 3;

    const query = {
      isAdmin: false,
      $or: [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } }
      ]
    };

    const userData = await User.find(query)
      .limit(limit)
      .skip((page - 1) * limit)
      .exec();

    const count = await User.countDocuments(query);

    res.render("customers", {
      data: userData,
      totalPages: Math.ceil(count / limit),
      currentPage: page
    });

  } catch (error) {
    console.error("Error in customerInfo:", error);
    res.redirect("/admin/pageerror");
  }
};



const customerBlocked = async (req, res) => {
  try {
    
    let id = req.query.id;
    await User.updateOne({ _id: id },{ $set: { isBlocked: true } });
    res.redirect("/admin/users")

  } catch (error) {
    res.redirect("/pageerror");
  }
};

const customerunBlocked = async (req, res) => {
  try {

    let id = req.query.id;
    await User.updateOne({ _id:id },{ $set: { isBlocked: false } });
    res.redirect("/admin/users")
    
  } catch (error) {

    res.redirect("/pageerror");
    
  }
};

module.exports = {
  customerInfo,
  customerBlocked,
  customerunBlocked,
}

