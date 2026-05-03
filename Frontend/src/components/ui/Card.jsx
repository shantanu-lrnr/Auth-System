const Card = ({ children, className = '', ...rest }) => (
  <div
    className={`surface rounded-xl p-6 sm:p-8 ${className}`}
    {...rest}
  >
    {children}
  </div>
)

export default Card
