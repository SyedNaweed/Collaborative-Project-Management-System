$(document).ready(function () {
  // 1. Dynamic Student Type Control
  function updateStudentTypeUI() {
    const studentType = $('input[name="studentType"]:checked').val() || $('#studentTypeSelect').val();
    const regContainer = $('#registerNumberContainer');
    const regInput = $('#registerNumber');
    const emailHint = $('#emailHelpText');

    if (studentType === 'INTERNAL') {
      regContainer.slideDown(200);
      regInput.prop('required', true);
      $('#regNumberRequiredMark').show();
      emailHint.html('<span class="text-primary"><i class="bi bi-info-circle"></i> Internal students must use institutional email ending with <strong>@vitstudent.ac.in</strong></span>');
    } else if (studentType === 'EXTERNAL') {
      regContainer.slideUp(200);
      regInput.prop('required', false);
      regInput.val(''); // Clear value so it does not send invalid format
      regInput.removeClass('is-invalid');
      $('#regNumberRequiredMark').hide();
      emailHint.html('<span class="text-warning"><i class="bi bi-exclamation-triangle"></i> External students must use personal email. Institutional VIT emails are strictly blocked.</span>');
    }
  }

  // Bind change listeners
  $('input[name="studentType"]').on('change', updateStudentTypeUI);
  $('#studentTypeSelect').on('change', updateStudentTypeUI);
  updateStudentTypeUI(); // Initial invoke

  // 2. Clear invalid states on typing
  $('input, select').on('input change', function () {
    $(this).removeClass('is-invalid');
    $(this).siblings('.invalid-feedback').text('');
  });

  // 3. Request OTP Handler
  $('#btnSendOtp').on('click', function () {
    const email = $('#email').val();
    const purpose = $(this).data('purpose') || 'REGISTRATION';
    const statusBox = $('#otpStatusAlert');

    if (!email || !email.trim()) {
      $('#email').addClass('is-invalid');
      $('#emailError').text('Please enter your email address first to receive an OTP.');
      return;
    }

    const $btn = $(this);
    $btn.prop('disabled', true).html('<span class="spinner-border spinner-border-sm"></span> Sending OTP...');

    $.ajax({
      url: '/auth/send-otp',
      type: 'POST',
      contentType: 'application/json',
      data: JSON.stringify({ email: email.trim(), purpose }),
      success: function (res) {
        $btn.prop('disabled', false).html('<i class="bi bi-send"></i> Resend OTP');
        statusBox.removeClass('alert-danger d-none').addClass('alert alert-success d-block');
        statusBox.html(`<strong>Success!</strong> ${res.message}`);
        if (res.devOtp) {
          $('#otp').val(res.devOtp); // Auto-fill in dev mode for easy test demonstration
        }
      },
      error: function (xhr) {
        $btn.prop('disabled', false).html('<i class="bi bi-send"></i> Send OTP');
        statusBox.removeClass('alert-success d-none').addClass('alert alert-danger d-block');
        const msg = xhr.responseJSON && xhr.responseJSON.message ? xhr.responseJSON.message : 'Error sending OTP.';
        statusBox.html(`<strong>Error:</strong> ${msg}`);
      }
    });
  });

  // 4. Student Registration Form Submission
  $('#studentRegisterForm').on('submit', function (e) {
    e.preventDefault();
    const form = $(this);
    const alertBox = $('#formAlert');
    alertBox.addClass('d-none').text('');
    $('.is-invalid').removeClass('is-invalid');
    $('.invalid-feedback').text('');

    const formData = {
      studentType: $('input[name="studentType"]:checked').val() || $('#studentTypeSelect').val(),
      fullName: $('#fullName').val(),
      registerNumber: $('#registerNumber').val(),
      email: $('#email').val(),
      username: $('#username').val(),
      password: $('#password').val(),
      confirmPassword: $('#confirmPassword').val(),
      otp: $('#otp').val()
    };

    const submitBtn = form.find('button[type="submit"]');
    submitBtn.prop('disabled', true).html('<span class="spinner-border spinner-border-sm"></span> Registering...');

    $.ajax({
      url: '/auth/student-register',
      type: 'POST',
      contentType: 'application/json',
      data: JSON.stringify(formData),
      success: function (res) {
        alertBox.removeClass('alert-danger d-none').addClass('alert alert-success d-block');
        alertBox.html(`<strong>Success!</strong> ${res.message}`);
        setTimeout(function () {
          window.location.href = res.redirectUrl || '/auth/login';
        }, 1500);
      },
      error: function (xhr) {
        submitBtn.prop('disabled', false).html('<i class="bi bi-person-plus-fill"></i> Complete Registration');
        const data = xhr.responseJSON;
        if (data && data.errors) {
          Object.keys(data.errors).forEach(function (field) {
            const input = $(`#${field}`);
            const feedback = $(`#${field}Error`);
            input.addClass('is-invalid');
            feedback.text(data.errors[field]);
          });
        } else {
          alertBox.removeClass('alert-success d-none').addClass('alert alert-danger d-block');
          alertBox.text((data && data.message) || 'Registration failed. Please check the entered fields.');
        }
      }
    });
  });

  // 5. Faculty Registration Form Submission
  $('#facultyRegisterForm').on('submit', function (e) {
    e.preventDefault();
    const form = $(this);
    const alertBox = $('#formAlert');
    alertBox.addClass('d-none').text('');
    $('.is-invalid').removeClass('is-invalid');
    $('.invalid-feedback').text('');

    const formData = {
      fullName: $('#fullName').val(),
      employeeId: $('#employeeId').val(),
      email: $('#email').val(),
      username: $('#username').val(),
      password: $('#password').val(),
      confirmPassword: $('#confirmPassword').val(),
      facultyCapacity: $('#facultyCapacity').val()
    };

    const submitBtn = form.find('button[type="submit"]');
    submitBtn.prop('disabled', true).html('<span class="spinner-border spinner-border-sm"></span> Registering Faculty...');

    $.ajax({
      url: '/auth/faculty-register',
      type: 'POST',
      contentType: 'application/json',
      data: JSON.stringify(formData),
      success: function (res) {
        alertBox.removeClass('alert-danger d-none').addClass('alert alert-success d-block');
        alertBox.html(`<strong>Success!</strong> ${res.message}`);
        setTimeout(function () {
          window.location.href = res.redirectUrl || '/auth/login';
        }, 1500);
      },
      error: function (xhr) {
        submitBtn.prop('disabled', false).html('<i class="bi bi-person-badge-fill"></i> Complete Faculty Registration');
        const data = xhr.responseJSON;
        if (data && data.errors) {
          Object.keys(data.errors).forEach(function (field) {
            const input = $(`#${field}`);
            const feedback = $(`#${field}Error`);
            input.addClass('is-invalid');
            feedback.text(data.errors[field]);
          });
        } else {
          alertBox.removeClass('alert-success d-none').addClass('alert alert-danger d-block');
          alertBox.text((data && data.message) || 'Faculty registration failed.');
        }
      }
    });
  });

  // 6. Login Form Submission (Student & Faculty)
  $('#loginForm').on('submit', function (e) {
    e.preventDefault();
    const form = $(this);
    const alertBox = $('#loginAlert');
    alertBox.addClass('d-none').text('');
    $('.is-invalid').removeClass('is-invalid');

    const formData = {
      username: $('#username').val(),
      password: $('#password').val()
    };

    const submitBtn = form.find('button[type="submit"]');
    submitBtn.prop('disabled', true).html('<span class="spinner-border spinner-border-sm"></span> Signing In...');

    $.ajax({
      url: '/auth/login',
      type: 'POST',
      contentType: 'application/json',
      data: JSON.stringify(formData),
      success: function (res) {
        alertBox.removeClass('alert-danger d-none').addClass('alert alert-success d-block');
        alertBox.html(`<strong>Authenticated!</strong> Redirecting to your dashboard...`);
        setTimeout(function () {
          window.location.href = res.redirectUrl || '/';
        }, 800);
      },
      error: function (xhr) {
        submitBtn.prop('disabled', false).html('<i class="bi bi-box-arrow-in-right"></i> Sign In');
        const data = xhr.responseJSON;
        alertBox.removeClass('alert-success d-none').addClass('alert alert-danger d-block');
        alertBox.text((data && data.message) || 'Invalid username or password.');
      }
    });
  });
});
