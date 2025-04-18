document.addEventListener("DOMContentLoaded", () => {
    // Loader
    const loader = document.querySelector(".loader")
  
    // Ocultar el loader después de que la página cargue
    window.addEventListener("load", () => {
      setTimeout(() => {
        loader.classList.add("hidden")
        // Iniciar animaciones AOS después de que el loader desaparezca
        initAOS()
      }, 1000)
    })
  
    // Función para inicializar animaciones al hacer scroll
    function initAOS() {
      const aosElements = document.querySelectorAll("[data-aos]")
  
      const checkIfInView = () => {
        aosElements.forEach((element) => {
          const elementPosition = element.getBoundingClientRect().top
          const windowHeight = window.innerHeight
          const elementVisible = 150
  
          if (elementPosition < windowHeight - elementVisible) {
            element.classList.add("aos-animate")
          }
        })
      }
  
      // Ejecutar una vez al inicio
      checkIfInView()
  
      // Ejecutar al hacer scroll
      window.addEventListener("scroll", checkIfInView)
    }
  
    // Rotación automática de imágenes en el mockup del teléfono
    const phoneScreens = document.querySelectorAll(".phone-mockup .phone-screen")
    let currentScreen = 0
  
    function rotateScreens() {
      // Ocultar todas las pantallas
      phoneScreens.forEach((screen) => {
        screen.classList.remove("active")
      })
  
      // Mostrar la siguiente pantalla
      currentScreen = (currentScreen + 1) % phoneScreens.length
      phoneScreens[currentScreen].classList.add("active")
    }
  
    // Iniciar la rotación cada 3 segundos
    setInterval(rotateScreens, 3000)
  
    // // Slider de testimonios
    // const testimonialCards = document.querySelectorAll(".testimonial-card")
    // const dots = document.querySelectorAll(".dot")
    // const prevBtn = document.querySelector(".testimonial-prev")
    // const nextBtn = document.querySelector(".testimonial-next")
    // let currentTestimonial = 0
  
    // function showTestimonial(index) {
    //   // Ocultar todos los testimonios
    //   testimonialCards.forEach((card) => {
    //     card.classList.remove("active")
    //   })
  
    //   // Desactivar todos los dots
    //   dots.forEach((dot) => {
    //     dot.classList.remove("active")
    //   })
  
    //   // Mostrar el testimonio seleccionado
    //   testimonialCards[index].classList.add("active")
    //   dots[index].classList.add("active")
    //   currentTestimonial = index
    // }
  
    // // Event listeners para los botones de navegación
    // prevBtn.addEventListener("click", () => {
    //   let index = currentTestimonial - 1
    //   if (index < 0) index = testimonialCards.length - 1
    //   showTestimonial(index)
    // })
  
    // nextBtn.addEventListener("click", () => {
    //   let index = currentTestimonial + 1
    //   if (index >= testimonialCards.length) index = 0
    //   showTestimonial(index)
    // })
  
    // // Event listeners para los dots
    // dots.forEach((dot, index) => {
    //   dot.addEventListener("click", () => {
    //     showTestimonial(index)
    //   })
    // })
  
    // // Cambiar automáticamente los testimonios cada 5 segundos
    // setInterval(() => {
    //   let index = currentTestimonial + 1
    //   if (index >= testimonialCards.length) index = 0
    //   showTestimonial(index)
    // }, 5000)
  
    // Animación para el texto del hero
    const heroTitle = document.querySelector(".hero-text h1")
    if (heroTitle) {
      const words = document.querySelectorAll(".hero-text h1 span")
      words.forEach((word, index) => {
        word.style.animationDelay = `${index * 0.1}s`
        word.style.opacity = "0"
        word.style.animation = "fadeIn 0.5s forwards"
      })
    }
  
    // Efecto hover para las tarjetas de características
    const featureCards = document.querySelectorAll(".feature-card")
    featureCards.forEach((card) => {
      card.addEventListener("mouseenter", function () {
        this.style.transform = "translateY(-10px)"
        this.style.boxShadow = "0 20px 40px rgba(0, 0, 0, 0.1)"
      })
  
      card.addEventListener("mouseleave", function () {
        this.style.transform = "translateY(0)"
        this.style.boxShadow = "0 10px 30px rgba(0, 0, 0, 0.05)"
      })
    })
  
    // Animación para los botones
    const buttons = document.querySelectorAll(".btn")
    buttons.forEach((button) => {
      button.addEventListener("mouseenter", function () {
        this.style.transform = "translateY(-3px)"
      })
  
      button.addEventListener("mouseleave", function () {
        this.style.transform = "translateY(0)"
      })
    })
  
    // Animación para el logo en el header
    const logo = document.querySelector(".logo img")
    logo.addEventListener("mouseenter", function () {
      this.style.transform = "scale(1.05)"
    })
  
    logo.addEventListener("mouseleave", function () {
      this.style.transform = "scale(1)"
    })
  
    // Menú móvil
    const mobileMenuToggle = document.querySelector(".mobile-menu-toggle")
    const navLinks = document.querySelector(".nav-links")
  
    if (mobileMenuToggle) {
      mobileMenuToggle.addEventListener("click", () => {
        navLinks.classList.toggle("active")
        const isOpen = navLinks.classList.contains("active")
        mobileMenuToggle.innerHTML = isOpen ? '<i class="fas fa-times"></i>' : '<i class="fas fa-bars"></i>'
      })
    }
  
    // Marcar sección activa en el menú
    const sections = document.querySelectorAll("section[id]")
    const navItems = document.querySelectorAll(".nav-links a")
  
    function highlightNavItem() {
      const scrollPosition = window.scrollY
  
      sections.forEach((section) => {
        const sectionTop = section.offsetTop - 100
        const sectionHeight = section.offsetHeight
        const sectionId = section.getAttribute("id")
  
        if (scrollPosition >= sectionTop && scrollPosition < sectionTop + sectionHeight) {
          navItems.forEach((item) => {
            item.classList.remove("active")
            if (item.getAttribute("href") === "#" + sectionId) {
              item.classList.add("active")
            }
          })
        }
      })
  
      // Si estamos en la parte superior, activar el primer elemento
      if (scrollPosition < 100) {
        navItems.forEach((item, index) => {
          item.classList.remove("active")
          if (index === 0) {
            item.classList.add("active")
          }
        })
      }
    }
  
    window.addEventListener("scroll", highlightNavItem)
    highlightNavItem() // Ejecutar una vez al cargar
  
    // Animación para el scroll suave
    document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
      anchor.addEventListener("click", function (e) {
        e.preventDefault()
  
        const targetId = this.getAttribute("href")
        if (targetId === "#") return
  
        const targetElement = document.querySelector(targetId)
        if (targetElement) {
          window.scrollTo({
            top: targetElement.offsetTop - 80,
            behavior: "smooth",
          })
  
          // Cerrar menú móvil si está abierto
          if (navLinks && navLinks.classList.contains("active")) {
            navLinks.classList.remove("active")
            mobileMenuToggle.innerHTML = '<i class="fas fa-bars"></i>'
          }
        }
      })
    })
  })
  